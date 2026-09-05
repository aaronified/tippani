// Shared visual primitives for the tippani UI (instructions §5–§6), plus thin
// compatibility exports the pre-redesign pages still import — the page pass
import { CATEGORY_DEFAULT_HEX, CATEGORY_SLOTS, categoryHidden, categoryName, categoryVar } from './theme.js'
// replaces those call sites, then the compat block can shrink.
import { Children, Component, Fragment, createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isGestureClip } from "./gestures.jsx";
import { groupedShortcuts, withShortcut } from "./keys.js";
// Cover/Placeholder resolve stored cover/poster paths to the local /covers URL.
import { coverImgURL } from "./api.js";
import { t, tNodes } from "./i18n.js";
import { PROVIDER_MARKS } from "./providerMarks.js";
import { Silhouette } from "./silhouette.jsx";

// ErrorBoundary — a render error anywhere below unmounts only to this fallback
// instead of white-screening the whole app (there was no boundary before, so
// one thrown component blanked everything, e.g. an engine that lacked a JS
// feature a page used). Shows the actual message so a phone report is
// diagnosable, and a reload escape hatch. `label` scopes the message.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // Surface the stack in the console for `shoot.js` / devtools capture.
    console.error("tippani render error:", error, info?.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px", textAlign: "center" }}
      >
        <p className="display-title" style={{ fontSize: 'var(--type-ui-22)', marginBottom: 8 }}>
          {t("shell.error.boundary.title")}
        </p>
        <p className="microcopy" style={{ marginBottom: 16 }}>
          {this.props.label
            ? t("shell.error.boundary.named.body", { name: this.props.label })
            : t("shell.error.boundary.body")}
        </p>
        <pre
          style={{
            textAlign: "left", whiteSpace: "pre-wrap", overflowWrap: "anywhere",
            fontFamily: "var(--font-mono)", fontSize: 'var(--type-mono-12)', color: "var(--error)",
            background: "var(--raised)", border: "1px solid var(--line)",
            borderRadius: 10, padding: "12px 14px", marginBottom: 18,
          }}
        >
          {String(this.state.error?.message || this.state.error)}
        </pre>
        <button
          type="button"
          className="tp-btn tp-btn-primary tactile"
          onClick={() => window.location.reload()}
        >
          {t("common.action.reload.label")}
        </button>
      </div>
    );
  }
}

// The four colour categories (§4, Kindle default yellow).
//
// The tokens are immutable storage and export keys. What they are CALLED and
// what they LOOK LIKE is per-user and lives in theme.js, which is why both of
// these are derived from it rather than written out again: this file held its
// own copy of the four hexes until 1.6.0, alongside two more in StagingPage and
// StatsPage, and a fourth in index.css. Two remain, and they are the two that
// genuinely cannot be one — the stylesheet's --hl-N and the JS value a canvas
// needs — with a test asserting they agree.
//
// ANNOTATION_HEX is the BUILT-IN map, not the live one. Anything drawing a
// colour now goes through categoryVar (CSS) or categoryHex (canvas) so a
// recoloured category is live; this is what those fall back to, and what the
// palette test pins the stylesheet against.
export const ANNOTATION_COLORS = CATEGORY_SLOTS;
export const ANNOTATION_HEX = Object.fromEntries(
  CATEGORY_SLOTS.map((tok, i) => [tok, CATEGORY_DEFAULT_HEX[i]]),
);
export const TAG_STYLES = ["sticker", "banner", "flyout", "tape", "reel"];

// useReveal — reveal-on-scroll (§5). Attach the ref to an element with
// className="reveal"; IO with a scroll fallback, reduced-motion honoured.
export function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-in");
      return;
    }
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (e.isIntersecting) {
              el.classList.add("is-in");
              io.disconnect();
            }
          }),
        { rootMargin: "0px 0px -8% 0px" },
      );
      io.observe(el);
      return () => io.disconnect();
    }
    const check = () => {
      if (el.getBoundingClientRect().top < window.innerHeight - 40) {
        el.classList.add("is-in");
        window.removeEventListener("scroll", check);
      }
    };
    window.addEventListener("scroll", check, { passive: true });
    check();
    return () => window.removeEventListener("scroll", check);
  }, []);
  return ref;
}

// useResolvedDark — true when theme.js resolved the theme to dark (topbar
// picks the mark variant with this).
export function useResolvedDark() {
  const [dark, setDark] = useState(
    () => document.documentElement.dataset.theme === "dark",
  );
  useEffect(() => {
    const fn = (e) => setDark(e.detail.dark);
    window.addEventListener("tippani:theme", fn);
    return () => window.removeEventListener("tippani:theme", fn);
  }, []);
  return dark;
}

// One source for mobile-specific UI decisions. This intentionally follows the
// browser's layout viewport, not the device/user-agent, so "desktop site" mode
// gets the desktop UI when the browser exposes a desktop-sized viewport.
export const MOBILE_SCREEN_QUERY = "(max-width: 768px)";

export function isMobileScreen() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.(MOBILE_SCREEN_QUERY).matches
  );
}

// useMediaMatch — does this media query hold, and re-render when it stops.
//
// TWO COPIES OF THIS EXISTED, verbatim, eight lines each: `useIsMobileScreen`
// and `useHideOnScrollDown` both wrote the same subscribe/sync/unsubscribe with
// the same legacy `addListener` fallback. Two copies of a subscription is two
// places a leak has to be fixed, and the fallback branch — for Safari before
// 14 — is exactly the kind of thing that gets remembered in one of them.
//
// `initial` is separate from the query because the two callers seed differently:
// one has a module-level reader it shares with non-React code, the other reads
// the query. Both are evaluated before the effect runs, so neither can flash.
function useMediaMatch(query, initial) {
  const [on, setOn] = useState(initial);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(query);
    const sync = () => setOn(media.matches);
    sync();
    if (media.addEventListener) {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
    // Safari before 14, which has matchMedia and not its event target.
    media.addListener?.(sync);
    return () => media.removeListener?.(sync);
  }, [query]);
  return on;
}

export function useIsMobileScreen() {
  return useMediaMatch(MOBILE_SCREEN_QUERY, isMobileScreen);
}

// TWO_COLUMN_QUERY is the width at which the work detail becomes two columns —
// the pack's own 1180, and the same number index.css uses for .tp-detail-hero.
//
// A JS BREAKPOINT HERE AND A MEDIA QUERY THERE, which looks like the constant
// living in two places and is the lesser of the two wrongs. The frame's geometry
// is CSS because a stylesheet can be tested and never re-renders; but WHICH hero
// component renders cannot be CSS, because rendering both and hiding one would
// put two <h1>s in the document — two page titles in the outline, and a screen
// reader reading the book's name twice. One number, stated twice, with this
// comment on both sides.
export const TWO_COLUMN_QUERY = "(min-width: 1180px)";

export function useTwoColumn() {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.(TWO_COLUMN_QUERY).matches,
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(TWO_COLUMN_QUERY);
    const sync = () => setWide(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);
  return wide;
}

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// useHideOnScrollDown — auto-hide for the floating mobile bottom bar.
//
// The app scrolls the WINDOW (App.jsx's scroll memory reads window.scrollY and
// every shell bar is fixed/sticky against the viewport), so window is the real
// scroller — no inner-container plumbing needed.
//
// Semantics: swiping UP to read further DOWN the page slides the bar away;
// scrolling back up, or coming within topZone of the top, brings it back.
// There is deliberately NO idle timer re-showing it after the finger lifts —
// that would put the bar back exactly while you are reading, which is the
// opposite of the pattern.
//
// Two things stop it flickering: the listener is passive and only schedules
// work (all measurement happens in one rAF tick per frame), and `threshold` px
// of one-way travel must accumulate before the state flips, so sub-pixel drift
// and iOS rubber-banding are ignored.
//
// `forceShow` pins it visible while a shell overlay is up. Reduced motion opts
// out of hiding altogether: the global `transition: none !important` would turn
// the slide into a jarring snap, so the honest behaviour is not to hide at all.
export function useHideOnScrollDown({
  enabled = true,
  forceShow = false,
  resetKey = null,
  threshold = 12, // px of one-way travel before the state flips (dead zone)
  topZone = 24, // px from the top where the bar is unconditionally shown
} = {}) {
  const [hidden, setHidden] = useState(false);
  const reduced = useMediaMatch(
    REDUCED_MOTION_QUERY,
    typeof window !== "undefined" && !!window.matchMedia?.(REDUCED_MOTION_QUERY).matches,
  );

  const active = enabled && !reduced && !forceShow;

  useEffect(() => {
    if (!active) {
      setHidden(false); // never strand the bar off-screen
      return;
    }
    let last = window.scrollY;
    let ticking = false;

    const measure = () => {
      ticking = false;
      const y = window.scrollY;
      const dy = y - last;
      if (y <= topZone) {
        last = y;
        setHidden(false);
        return;
      }
      // Sub-threshold: keep `last` where it is so slow travel still accumulates.
      if (Math.abs(dy) < threshold) return;
      last = y;
      setHidden(dy > 0); // scrollY grew ⇒ reading further down ⇒ slide away
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(measure);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [active, threshold, topZone]);

  // A route change always re-shows: Shell's scroll effect jumps to the top or to
  // a remembered offset, so the previous screen's hide is stale either way.
  useEffect(() => {
    setHidden(false);
  }, [resetKey]);

  return active ? hidden : false;
}

// useBackToTop — whether the way back is worth offering, and the way back.
//
// A WORK WITH 128 QUOTES IS A LONG WAY DOWN, and on a phone the way back was a
// minute of flicking: there is no scrollbar to drag and no Home key to press. The
// app had no such control on any screen; the only scrollTo in the tree is the
// shell's own scroll-restore.
//
// MEASURED AGAINST THE SCROLLABLE DISTANCE, NOT A PIXEL COUNT, which is the pack's
// rule and the part worth keeping: "what makes a page long is how far there is to
// come back, so a short book never grows the key and a long one gets it a quarter
// down". A fixed 600px trigger would put the key on a three-quote book that has
// 600px of hero.
//
// 260 and 0.25 are the pack's numbers. The floor of 200 stops a page that is
// barely scrollable from arming the key in its first thumb-length.
//
// SMOOTH ONLY WHEN MOTION IS WANTED. A reader who has asked for less of it gets
// the jump, which is the same answer every other transition in the app gives —
// and a 4000px smooth scroll is the single longest animation this app can play.
export function useBackToTop({ enabled = true } = {}) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!enabled) {
      setShow(false)
      return undefined
    }
    let ticking = false
    const measure = () => {
      ticking = false
      const max = document.documentElement.scrollHeight - window.innerHeight
      setShow(max > 260 && window.scrollY > Math.max(200, max * 0.25))
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(measure)
    }
    // Measured once on mount as well as on scroll: arriving at a remembered
    // offset (the shell restores one per route) is a scroll that never fires.
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [enabled])
  const toTop = useCallback(() => {
    const smooth = !window.matchMedia?.(REDUCED_MOTION_QUERY).matches
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
    setShow(false)
  }, [])
  return { show, toTop }
}

// ---- what the breadcrumb calls the thing you have open ---------------------
//
// THE SHELL DRAWS THE CRUMB AND THE SCREEN KNOWS THE TITLE, and they are three
// components apart. Threading a prop from Shell through Library into BookDetail
// would put a shell concern in the signature of two screens that have no other
// reason to care — and the Catalogue would need the identical pair, so the price
// is paid twice for one string.
//
// A tiny store instead, in the shape `toast` already uses here: the screen
// publishes, the shell subscribes. Publishing null on unmount is not optional —
// a stale title outliving its screen is a breadcrumb pointing at a work you have
// closed, which is worse than no breadcrumb.
let crumbTitle = null
const crumbSubs = new Set()
function publishCrumb(v) {
  crumbTitle = v || null
  for (const fn of crumbSubs) fn(crumbTitle)
}
// Called by whatever screen owns a detail. Cleans up after itself.
export function useCrumb(title) {
  useEffect(() => {
    publishCrumb(title)
    return () => publishCrumb(null)
  }, [title])
}
// Called by the shell.
export function useCrumbTitle() {
  const [v, setV] = useState(crumbTitle)
  useEffect(() => {
    crumbSubs.add(setV)
    setV(crumbTitle)
    return () => crumbSubs.delete(setV)
  }, [])
  return v
}

// ---- a screen that owns its own scrolling -----------------------------------
//
// EVERY SCREEN IN THIS APP SCROLLS THE WINDOW, and the work detail is the first
// one that cannot. The pack draws it as two columns that scroll independently —
// the hero stays put while the quotes move — and independence is impossible while
// the thing doing the scrolling is the page underneath both of them.
//
// SO THE SCREEN DECLARES IT AND THE SHELL ACTS ON IT, in the store shape the crumb
// above already uses, rather than a prop threaded from App through Library into
// BookDetail. Two screens would carry a shell concern in their signature for a
// fact neither of them uses, and the Catalogue needs the identical pair.
//
// IT IS OPT-IN PER SCREEN, and that is the whole point of the flag rather than a
// stylesheet rule: Library, Quotes and the Catalogue have not had their passes
// yet and must keep scrolling the way they always have. A global change here
// would silently re-lay-out nine screens nobody has looked at.
//
// AND IT IS DESKTOP-ONLY BY THE CALLER'S CHOICE. On one column, independence
// buys nothing structural — while a body locked at 100dvh is the most reliable
// mobile layout bug there is, and takes URL-bar collapse and pull-to-refresh with
// it. The hook does what it is told: Library.jsx passes `wide`, which is
// TWO_COLUMN_QUERY, so everything below 1180px — phone and tablet alike — keeps
// the window scroller it has always had.
let screenScroll = false
const scrollSubs = new Set()
function publishScreenScroll(v) {
  screenScroll = !!v
  for (const fn of scrollSubs) fn(screenScroll)
}

// useScreenOwnsScroll — called by the screen. `on` may be false, so one caller can
// hold the hook unconditionally and decide by width, which is what the rules of
// hooks require of it.
//
// PUBLISHING FALSE ON UNMOUNT IS NOT OPTIONAL, for the crumb's reason one step
// worse: a stale crumb is a wrong word, and a stale lock is a page that cannot be
// scrolled at all on a screen with no other scroller in it.
export function useScreenOwnsScroll(on) {
  useEffect(() => {
    publishScreenScroll(on)
    return () => publishScreenScroll(false)
  }, [on])
}

// Called by the shell.
export function useScreenScroll() {
  const [v, setV] = useState(screenScroll)
  useEffect(() => {
    scrollSubs.add(setV)
    setV(screenScroll)
    return () => scrollSubs.delete(setV)
  }, [])
  return v
}

// ---- what the phone's two bars carry ---------------------------------------
//
// THE PHONE'S TOP BAR IS A HEADER AND ITS BOTTOM BAR IS THE VERBS. Nine
// destinations pinned beside a 390px screen would leave 320px of book, so they
// go behind ☰ and the bar that used to hold four of them holds what you can DO
// on the screen you are looking at instead. That is what frees the top edge to
// be a title and a line of facts about it rather than a strip of glyphs.
//
// Same store shape as the crumb above, and deliberately the same one: a screen
// that publishes a title almost always publishes a sub-line and a verb set in
// the same breath, and three parallel stores would be three chances for one of
// them to outlive its screen. Publishing null on unmount is not optional here
// either — a dock still offering "Filter" for a work you closed is a key that
// does nothing, which is worse than a key that is absent.
let screenBar = { sub: null, keys: null }
const barSubs = new Set()
function publishBar(v) {
  screenBar = v
  for (const fn of barSubs) fn(screenBar)
}

// useScreenBar — the phone header's sub-line and the dock's verbs, published by
// the screen that owns them.
//
// `keys` is at most TWO: the dock seats five and three are spoken for — the pair
// that never moves (Back, Search) and the ＋ in the middle, which is arithmetic
// rather than a preference. Past five the thumb checks instead of aiming, so a
// third verb is not a tight fit; it is a different control, and it belongs behind
// the More key that is usually one of the two.
//
// A key is `{ id, label, icon, onClick }`, or `{ id, node }` when the screen has
// to own the element itself — a MoreMenu anchors its popover to its own trigger,
// so a shell-rendered button could not open one. The shell still owns the SEAT;
// what sits in it is the screen's.
export function useScreenBar({ sub = null, keys = null, actions = null } = {}) {
  // Serialised rather than compared by identity: a caller building its key array
  // inline would otherwise republish on every render and re-run every subscriber.
  const stamp = keys ? keys.map((k) => k && k.id).join('|') : ''
  useEffect(() => {
    publishBar({ sub, keys })
    return () => publishBar({ sub: null, keys: null })
  }, [sub, stamp]) // eslint-disable-line react-hooks/exhaustive-deps

  // `actions` IS A BUILDER, NOT A LIST, AND IT IS NOT PUBLISHED.
  //
  // The screen menu is a menu bar: it names which view you are in, which sort is
  // running, which filters are on. That is STATE, and a list published through the
  // subscription above would go stale the moment any of it changed — the id stamp
  // would not move, nothing would re-publish, and the menu would tick the view you
  // left. Stamping the state instead only moves the problem: every closure in the
  // list would still have to be covered by the stamp, and the one that was not is
  // the bug nobody finds.
  //
  // So the shell holds a pointer to the CURRENT builder and calls it at the moment
  // the ⋯ opens. Re-pointed after every render of the owning screen, which is one
  // assignment; there is nothing to diff, nothing to serialise, and nothing that
  // can be one render behind. Deliberately no dependency array.
  useEffect(() => {
    if (!actions) return undefined
    screenActions.add(actions)
    // Removed by identity, so a screen leaving cannot clear the one arriving —
    // during a transition both are briefly registered, which is correct: the menu
    // is about to be rebuilt for whichever survives.
    return () => screenActions.delete(actions)
  })
}

// EVERY BUILDER ON SCREEN, NOT ONE. A slot would be right if a screen were always
// one component, and Checks is the counter-example that was already in the tree:
// it composes the staging queue and the stray-marks list, both `embedded`, both
// entitled to publish. With a single slot whichever rendered last would silently
// win and the other half of the page would have no actions at all — a bug that
// looks exactly like "that section just does not have any".
//
// A Set rather than an array because registration is idempotent and insertion
// order is what a Set preserves anyway, which is the order the sections are drawn
// in and therefore the order a reader expects them in the menu.
const screenActions = new Set()

// buildScreenActions — what the ⋯ should show right now, or [] if nothing on
// screen has published. Called by the shell when the menu opens.
export function buildScreenActions() {
  const out = []
  for (const build of screenActions) {
    try {
      const items = build()
      if (items && items.length) out.push(...items)
    } catch (err) {
      // ONE SECTION'S BUILDER MUST NOT TAKE THE MENU DOWN. The ⋯ is on every
      // screen, so an exception thrown here is an app-wide dead control rather
      // than one broken section — and on a composed page it would also lose the
      // OTHER section's actions, which had nothing to do with it.
      console.error('[shell] screen actions failed to build', err)
    }
  }
  return out
}
// Called by the shell.
export function useScreenBarState() {
  const [v, setV] = useState(screenBar)
  useEffect(() => {
    barSubs.add(setV)
    setV(screenBar)
    return () => barSubs.delete(setV)
  }, [])
  return v
}

// ---- the edge fade: how a scroller says it scrolls ------------------------
//
// AN EDGE FADE MEANS THE ROW SCROLLS. Wherever content outruns its box the last
// EDGE_FADE_X (sideways) or EDGE_FADE_V (down) of it dissolves, and that fade is
// the whole signal — no arrows, no scrollbar, no counter. A button at the fade is
// a different promise: it opens the full set in a sheet. So a row may scroll, or
// open, or both, and a reader can tell which without trying.
//
// The corollary is the part that bites: NEVER COLLAPSE A LIST TO FIT. Truncating
// a person's name because the row is narrow is not a tidier version of scrolling,
// it is a different and worse answer — the reader cannot tell a shortened name
// from a short one, so the ellipsis destroys the very thing they were reading.
//
// WHY AN ATTRIBUTE AND NOT STATE. `data-scroll-x` / `data-scroll-v` are written
// straight onto the node. Routing this through `useState` would re-render the
// subtree on every frame of a swipe, for a change no React tree can express
// better than one attribute can. The mask that reads it is pure CSS, so the
// scroll path stays: one read, one compare, and usually no write at all.
//
// WHY IT IS MEASURED AT ALL, rather than a gradient that is always on. A fade
// with nothing behind it is a lie — it promises more content to a row that has
// none, and the reader learns to distrust every other fade in the app. So the
// attribute names which ends actually have more: "start", "end", "both", or the
// attribute is absent and there is no mask.
//
// WHAT WATCHES. A ResizeObserver on the scroller AND on its children (the child
// is what grows when a font finally loads or a label gets longer), re-seated by a
// MutationObserver when the child list itself changes. All three coalesce into
// one rAF. This is deliberately not a poll: the prototype this came from ran a
// 400ms interval that called getComputedStyle on every node in the document —
// 2.5 full layout passes a second, forever, on a page nobody was touching.
export const EDGE_FADE_X = 26; // px — a sideways fade is spacing, so it is px
export const EDGE_FADE_V = "1.6em"; // em — a downward fade must land on the LAST LINE
const EDGE_SLACK = 1; // a scroller parked at its end can still report 0.4px left
const DRAG_SLOP = 3; // px of travel before a press counts as a drag, not a click

export function useEdgeScroll(ref, { axis = "x", drag = true } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A wrapper can scroll in both directions at once — the annotation tables do,
    // being wide AND capped in height — and then it wears both attributes.
    const axes = axis === "both" ? ["x", "v"] : [axis];
    let ticking = false;

    const measure = () => {
      ticking = false;
      for (const a of axes) {
        const attr = a === "x" ? "data-scroll-x" : "data-scroll-v";
        const pos = a === "x" ? el.scrollLeft : el.scrollTop;
        const size = a === "x" ? el.clientWidth : el.clientHeight;
        const full = a === "x" ? el.scrollWidth : el.scrollHeight;
        // scrollLeft goes NEGATIVE in a right-to-left row, so compare on distance
        // travelled rather than on sign — Bengali is a left-to-right script, but
        // the app is one `dir` attribute away from proving that assumption wrong.
        const from = Math.abs(pos);
        const before = from > EDGE_SLACK;
        const after = from + size < full - EDGE_SLACK;
        const state = before && after ? "both" : before ? "start" : after ? "end" : "";
        if (!state) el.removeAttribute(attr);
        else if (el.getAttribute(attr) !== state) el.setAttribute(attr, state);
      }
    };
    const schedule = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(measure);
    };

    el.addEventListener("scroll", schedule, { passive: true });

    let ro = null;
    let mo = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(schedule);
      const seat = () => {
        ro.disconnect();
        ro.observe(el);
        for (const child of el.children) ro.observe(child);
        schedule();
      };
      seat();
      if (typeof MutationObserver !== "undefined") {
        // childList only, and not the subtree: anything deeper changes a CHILD's
        // box, which the ResizeObserver already sees. Watching the subtree would
        // re-seat the observers on every keystroke inside the row.
        mo = new MutationObserver(seat);
        mo.observe(el, { childList: true });
      }
    }
    measure();

    return () => {
      el.removeEventListener("scroll", schedule);
      ro?.disconnect();
      mo?.disconnect();
      el.removeAttribute("data-scroll-x");
      el.removeAttribute("data-scroll-v");
    };
  }, [ref, axis]);

  // ---- press-and-drag ------------------------------------------------------
  //
  // `overflow` alone is a TOUCH-ONLY affordance. A trackpad can swipe sideways
  // and a wheel can be shift-held, but a plain mouse has no gesture for it at
  // all — so on that pointer the row is simply stuck, with a fade promising
  // content it will not give up. Press-and-drag closes that.
  //
  // THE LISTENERS ARE ON THE SCROLLER, NOT THE DOCUMENT. `setPointerCapture`
  // retargets every later move and the release to this element, so a drag that
  // leaves the row still lands here — which is how the prototype's delegated
  // document listener is avoided. Nothing in the app listens at rest.
  //
  // AND THE CAPTURE IS TAKEN ON THE FIRST MOVE PAST THE SLOP, NEVER ON THE PRESS.
  // This is not a refinement; capturing on pointerdown silently killed every
  // click inside every scroller in the app. Pointer capture retargets the CLICK
  // too — Gecko dispatches it at the capturing element rather than at the button
  // under the finger — so React, which reads the native event's path, never saw
  // the button and never ran its handler. Measured, not reasoned: a press on a
  // <button> inside a capturing div reports `click target=nav`, and the button's
  // own listener does not run. It took out the rail's nine destinations, every
  // annotation table's rows, the Stats activity calendar and the cast strip,
  // while the two rail rows OUTSIDE the scrolling <nav> kept working — which is
  // the shape of the bug report that found it.
  //
  // Deferring the capture costs nothing: until the pointer has moved 3px there is
  // no drag to keep hold of, and a press that never moves is a click, which is
  // now left alone to be one.
  useEffect(() => {
    const el = ref.current;
    if (!el || !drag) return;
    const wantX = axis === "x" || axis === "both";
    const wantV = axis === "v" || axis === "both";
    let id = null;
    let originX = 0;
    let originY = 0;
    let fromLeft = 0;
    let fromTop = 0;
    let moved = false;
    let held = false; // whether this element actually holds the pointer capture

    const onDown = (e) => {
      // Touch scrolls natively, with momentum this cannot reproduce; taking the
      // gesture away from it would be a downgrade dressed as a feature.
      if (e.pointerType === "touch" || e.button !== 0) return;
      // A press that starts inside a field is a text selection, not a drag.
      if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
      el.removeAttribute("data-dragged"); // a drag that ended off-row left this set
      id = e.pointerId;
      originX = e.clientX;
      originY = e.clientY;
      fromLeft = el.scrollLeft;
      fromTop = el.scrollTop;
      moved = false;
      held = false;
    };

    const onMove = (e) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - originX;
      const dy = e.clientY - originY;
      if (!moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
      if (!moved) {
        el.setAttribute("data-dragging", "1");
        // NOW it is a drag, so now the capture is worth its cost: from here the
        // pointer may leave the row and the release still has to land here.
        el.setPointerCapture?.(e.pointerId);
        held = true;
      }
      moved = true;
      if (wantX) el.scrollLeft = fromLeft - dx;
      if (wantV) el.scrollTop = fromTop - dy;
      e.preventDefault(); // otherwise the drag paints a text selection behind it
    };

    const onUp = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      if (held) el.releasePointerCapture?.(e.pointerId);
      held = false;
      el.removeAttribute("data-dragging");
      // The click that follows this release belongs to the drag, not to whatever
      // sits under the finger at the end of it. Dragging a row of covers must
      // never open the cover you happened to let go on.
      if (moved) el.setAttribute("data-dragged", "1");
    };

    const onClick = (e) => {
      if (!el.hasAttribute("data-dragged")) return;
      el.removeAttribute("data-dragged");
      e.preventDefault();
      e.stopPropagation();
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    // Capture phase, so it beats the handler on the card the pointer came to rest
    // over — by the bubble phase that card has already opened.
    el.addEventListener("click", onClick, true);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("click", onClick, true);
      el.removeAttribute("data-dragging");
      el.removeAttribute("data-dragged");
    };
  }, [ref, axis, drag]);
}

// Scroller — a plain box that fades at whichever end still has content. Use it
// wherever the markup is just a wrapper; where the element already carries a ref
// and a job of its own (the top bar's nav, the help rail), call `useEdgeScroll`
// on that ref instead of wrapping it in another div.
// `as` because a scrolling row is not always allowed to be a div: the chip row on
// a favourite tile draws INSIDE that tile's button, whose content model is
// phrasing only, and a div there is invalid markup. A span with `display: flex`
// lays out identically, so the caller picks the element and the behaviour is the
// same either way.
export function Scroller({ as: Tag = "div", axis = "x", drag = true, className = "", children, ...rest }) {
  const ref = useRef(null);
  useEdgeScroll(ref, { axis, drag });
  return (
    <Tag ref={ref} className={className} {...rest}>
      {children}
    </Tag>
  );
}

// The demo stands still, so it states the attribute the hook would have computed —
// the alternative is a glossary entry for a fade that renders without its fade.
if (import.meta.env.DEV) {
  Scroller.glossary = {
    demo: (h) =>
      h(
        Scroller,
        {
          "data-scroll-x": "both",
          style: { maxWidth: 340, whiteSpace: "nowrap", overflowX: "auto" },
        },
        "Rabindranath Tagore \u00b7 Satyajit Ray \u00b7 Mahasweta Devi \u00b7 Jibanananda Das \u00b7 Ritwik Ghatak",
      ),
  };
}

// ---- the work detail's frame ------------------------------------------------
//
// TWO COLUMNS THAT SCROLL INDEPENDENTLY, which is the pack's own drawing and the
// reason the screen opts out of window scrolling at all: the hero stays put while
// the quotes move. It lives here rather than in a screen because both detail
// components call it — a book's and a film's — and the first screen to reach a
// shared piece must not be the one that designs it.
//
// GEOMETRY IS CUSTOM PROPERTIES IN index.css, NOT NUMBERS HERE, and the two-column
// switch is a media query rather than a measured width. A JS breakpoint would
// re-render the whole stream on every resize frame to change one layout, and it
// would put a constant in a place `spacing-debt.test.js` cannot count.
//
// BOTH COLUMNS ARE Scroller, never bare overflow — the standing rule, and here it
// earns its keep twice over: a column with no fade is a column a reader does not
// know continues. The fade is a mask and a mask CLIPS, so `--detail-pad` is at
// least the fade's own 1.6em: a cover's drop-shadow inside that band would be cut
// off at the top of the hero and look flat on this screen and nowhere else.
// useEdgeScroll DIRECTLY RATHER THAN Scroller, and it is not a shortcut past the
// rule — the rule names both. Scroller owns its ref internally and spreads the
// caller's props AFTER it, so a `ref` passed in would clobber the one the hook
// needs and the column would silently lose its fade. The frame needs those refs
// for the per-column scroll memory below, so it holds them itself.
export function DetailFrame({ hero, stream, heroRef, streamRef, streamProps = {}, className = '', ...rest }) {
  // The refs are OPTIONAL. A caller that wants the per-column scroll memory owns
  // them and passes them in; one that only wants the frame should not have to
  // create two refs it never reads. Both are made unconditionally either way,
  // because a hook behind an `if` is not a hook.
  const ownHero = useRef(null)
  const ownStream = useRef(null)
  const heroEl = heroRef || ownHero
  const streamEl = streamRef || ownStream
  useEdgeScroll(heroEl, { axis: 'v', drag: false })
  useEdgeScroll(streamEl, { axis: 'v', drag: false })
  return (
    <div className={`tp-detail ${className}`.trim()} {...rest}>
      <div ref={heroEl} className="tp-detail-hero">{hero}</div>
      <div ref={streamEl} className="tp-detail-stream" {...streamProps}>{stream}</div>
    </div>
  )
}

// The glossary's page is a scrolling column of its own, so the demo states a
// height — a frame that means "fill the screen" would otherwise fill the entry.
if (import.meta.env.DEV) {
  DetailFrame.glossary = {
    demo: (h) =>
      h(DetailFrame, {
        style: { height: 220 },
        hero: h('div', null, 'The cover, the title, the credits — the column that stays put.'),
        stream: h('div', null, 'The quotes, which move independently of it.'),
      }),
  }
}

// useColumnScroll — one column's place, remembered per work.
//
// THE SHELL'S RESTORATION CANNOT SERVE THIS. App.jsx remembers `window.scrollY`
// against a list path, and on this screen the window does not scroll and there are
// TWO positions rather than one. It is also deliberately not persisted: a reader
// coming back to a book tomorrow wants the top of it, and a reader who stepped
// into a quote and pressed Back wants where they were. A module Map answers the
// second and forgets the first on reload, which is the right pair.
const columnScroll = new Map()
export function useColumnScroll(ref, key) {
  useEffect(() => {
    const el = ref.current
    if (!el || !key) return
    const y = columnScroll.get(key)
    let stop = false
    // THE COLUMN IS NOT TALL ENOUGH TO HOLD THE POSITION YET, and a scrollTo that
    // arrives early does not fail — it CLAMPS, silently, to the top. The stream's
    // quotes are fetched after mount, so at the moment this effect first runs the
    // column holds a filter bar and nothing else, and a single restore attempt is
    // a restore to 0 every time: the memory looked implemented and remembered
    // nothing. App.jsx's window restore has retried across frames for exactly this
    // reason since it was written; this is that loop, per column.
    //
    // ~0.7s of frames is the same cap, and the same reasoning: a list that has not
    // arrived by then is not arriving, and spinning longer would scroll a reader
    // who has already started reading somewhere else.
    let tries = 0
    const attempt = () => {
      if (stop || !ref.current) return
      const node = ref.current
      if (node.scrollHeight - node.clientHeight >= y || tries > 40) {
        // INSTANT, for App.jsx's stated reason: gliding to a remembered position
        // scrolls the whole column past a reader to land where they already were.
        node.scrollTo({ top: y, behavior: 'instant' })
        return
      }
      tries++
      requestAnimationFrame(attempt)
    }
    if (y) requestAnimationFrame(attempt)
    return () => {
      stop = true
      // Read on unmount rather than on every scroll event: the number is only ever
      // wanted once, and a listener on a column being flung is a write per frame.
      columnScroll.set(key, el.scrollTop)
    }
  }, [ref, key])
}

// ---- how many columns a board gets ---------------------------------------
//
// PAIRED WITH --container-max IN index.css, and neither table means anything
// without the other. The container widens in steps; each step has a rung here,
// because the point of a wider window is MORE CARDS, not wider ones. Raise the
// cap alone and a quote card grows to 600px across, which is a worse card on a
// bigger screen — the reason the app looked capped at 1180px was never the cap
// on its own, it was that nothing downstream would have used the space.
//
// The rungs read against the VIEWPORT (that is what useColumnsAt measures) and
// the container is what actually holds the cards, so the arithmetic that
// matters is container ÷ columns: 1180/3 ≈ 390, 1500/4 ≈ 375, 1760/5 ≈ 352.
// Roughly one card width throughout, which is the intent.
//
// BOARD_COLUMNS is the tile boards — Library and the Catalogue, whose cards are
// covers and posters. QUOTE_COLUMNS is the same ladder for cards that are
// mostly text: it holds two columns down to 860px rather than 640px, because a
// quote wrapped to 300px is a column of syllables.
export const BOARD_COLUMNS = [[1900, 5], [1600, 4], [1280, 3], [640, 2]]
export const QUOTE_COLUMNS = [[1900, 5], [1600, 4], [1280, 3], [860, 2]]

// useScrolledPast — has this point scrolled out of the top of whatever is
// scrolling it? Returns [past, ref]; put the ref on a marker and the answer
// follows it.
//
// IT FINDS ITS OWN SCROLLER, by walking up for the first ancestor whose computed
// overflow-y actually scrolls, and falls back to the window when there is none.
// That matters more here than it looks: a work's header lives in a column that
// scrolls independently above 1180 and in a page that scrolls with the window
// below it, and the one component drawing that header must not have to be told
// which — a prop saying "here is my scroll container" is the second thing a
// caller can get wrong.
//
// ---- AN INTERSECTIONOBSERVER CANNOT ANSWER THIS, and it took a browser to show
// it. The obvious build is an observer on the marker: not intersecting, and above
// the root's top, means scrolled past. It is wrong in the case that matters, and
// wrong SILENTLY — every measurement agreed the marker was above the top and
// nothing ever told the hook.
//
// An observer fires on a CHANGE of intersection. On a window short enough that
// the marker starts below the fold, the marker goes from below the root to above
// the root WITHOUT EVER INTERSECTING IT: the state is false at the start and
// false at the end, so there is no change, so there is no callback. Measured in
// Firefox at 1440x340 — the observer fired exactly once, at mount, and never
// again however far the column scrolled. And the shorter the window, the more
// certainly this happens, which is precisely the window where a compact header is
// worth having.
//
// So: a passive scroll listener and a rect comparison, coalesced to one read per
// frame. React bails out of a set that does not change the value, so the steady
// state costs a comparison and nothing else.
export function useScrolledPast() {
  const [past, setPast] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let root = el.parentElement;
    while (root && root !== document.body) {
      const oy = getComputedStyle(root).overflowY;
      if (oy === "auto" || oy === "scroll") break;
      root = root.parentElement;
    }
    if (root === document.body) root = null; // the window is the scroller
    const scroller = root || window;
    let raf = 0;
    const read = () => {
      raf = 0;
      if (!ref.current) return;
      const top = root ? root.getBoundingClientRect().top : 0;
      setPast(ref.current.getBoundingClientRect().top < top);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    // The answer changes on a resize with no scroll at all: the column grows, the
    // marker comes back into view, and nothing scrolled.
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // The marker is rendered unconditionally on the first render, so there is
    // nothing to re-key on — unlike useColumnsIn's board, which mounts late.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [past, ref];
}

// useColumnsIn — the column count for a board that does NOT span the window.
//
// WHY useColumnsAt IS NOT ENOUGH ANY MORE, and it is worth saying plainly because
// the ladder above was correct for years. It reads `window.innerWidth`, which was
// the same question as "how wide is the container" for as long as every board sat
// in the page's one centred container. The work detail broke that: its quote board
// lives in a stream column that is the window MINUS the rail MINUS the hero, and
// then capped at 880px for measure. On a 1920px screen the ladder therefore asked
// for FIVE columns inside 880px — 176px each, a column of syllables, which is the
// exact failure QUOTE_COLUMNS' own comment says it exists to prevent.
//
// So this measures the element instead, and the ladder it takes is in CONTAINER
// pixels rather than viewport ones. The arithmetic the comment above calls "the
// one that matters" — container ÷ columns ≈ one card wide — is now the arithmetic
// actually being done.
//
// A ResizeObserver rather than a resize listener: the container changes width when
// the window does, but ALSO when the rail collapses to glyphs, when the hero
// column appears at 1180, and when a panel opens — none of which fire `resize`.
// A CALLBACK REF, NOT A useRef, and the first version of this got it wrong in the
// way that is invisible until something uses it. It took a ref OBJECT and keyed
// its effect on `[ref]` — and a ref object never changes, so the effect ran once,
// on mount, when `ref.current` was still null because the board it wanted to
// measure only renders after the quotes have loaded. It bailed at `if (!el)
// return` and never ran again: the count stayed at its initial 1 for ever, on
// every screen, at every width.
//
// That is exactly the shape of bug a dead export hides. This hook and its ladder
// sat written-but-uncalled through several passes, so nothing ever ran the branch
// that mattered; the first time it was wired, the board drew ONE 880px column and
// the guard that was supposed to catch a bad ladder passed, because one enormous
// column is not the failure it was written to look for.
//
// Returning [cols, ref] rather than taking one: the ref is state, so an element
// that arrives late — or is swapped when the view changes — re-runs the effect.
export function useColumnsIn(ladder) {
  const [el, setEl] = useState(null);
  const [n, setN] = useState(1);
  useEffect(() => {
    if (!el) return;
    const read = (w) => {
      for (const [min, cols] of ladder) if (w >= min) return cols;
      return 1;
    };
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width || el.clientWidth;
      if (w > 0) setN(read(w));
    });
    ro.observe(el);
    setN(read(el.clientWidth || 0));
    return () => ro.disconnect();
    // ladder is a static literal per call site; intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el]);
  return [n, setEl];
}

// QUOTE_COLUMNS_IN — the same intent as QUOTE_COLUMNS, measured against the board
// rather than the window, and DELIBERATELY MORE GENEROUS. The rungs are set from
// the owner's own report: on a 1080p screen the board was drawing four columns of
// about 170px and "the annotations need at least double the width". A quote is
// read, not glanced at, so its card gets ~400px — which in this screen's 880px
// stream is two columns, and on a board that spans a whole page is still five.
export const QUOTE_COLUMNS_IN = [[2000, 5], [1600, 4], [1200, 3], [800, 2]];

// useColumnsAt — the live column count for a Masonry, from a [minWidthPx, cols]
// ladder (largest breakpoint first; below the smallest ⇒ 1 column). Mirrors the
// Tailwind breakpoints the old CSS-column boards used, e.g. [[1280,3],[640,2]].
export function useColumnsAt(ladder) {
  const read = () => {
    if (typeof window === "undefined") return 1;
    const w = window.innerWidth;
    for (const [min, cols] of ladder) if (w >= min) return cols;
    return 1;
  };
  const [n, setN] = useState(read);
  useEffect(() => {
    const fn = () => setN(read());
    window.addEventListener("resize", fn);
    fn();
    return () => window.removeEventListener("resize", fn);
    // ladder is a static literal per call site; intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return n;
}

// useBodyScrollLock — freezes body scroll while a full-viewport overlay (the
// drawer, a mobile sheet) is up, so touch-scrolling the overlay can't scroll
// the page behind it. overflow:hidden rather than the position:fixed trick:
// every overlay here owns its own scroll container, so hiding body overflow
// removes the bleed-through without the scroll-position save/restore dance
// (and its jump-to-top failure mode). Ref-counted so stacked overlays don't
// unlock early. If iOS rubber-banding ever gets reported, position:fixed with
// a stored scroll offset is the upgrade path.
let bodyScrollLocks = 0;
export function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return;
    if (++bodyScrollLocks === 1) document.body.style.overflow = "hidden";
    return () => {
      if (--bodyScrollLocks === 0) document.body.style.overflow = "";
    };
  }, [active]);
}

// useBackToClose — an open overlay answers the hardware/gesture Back by closing
// itself, and closing itself gives the entry back.
//
// THE RULE THE READER STATED: "the back action needs to be global, no matter in
// which menu. back buttons and software back actions (in desktop browser or
// phone gestures/buttons) should be in sync." On a phone, Back is the close
// gesture — every other app on the device teaches that — and an overlay that
// ignores it turns the most reflexive press available into "leave the screen you
// were reading", with the dialog still up when you come back to it.
//
// The Lightbox has done this since covers became openable, and it was the only
// thing that did: the settings panels, every edit form, the Add surface, the
// filter sheets and the drawer all sat over a page whose Back went somewhere
// else. This is that one implementation, named and shared, so the next overlay
// gets it by asking rather than by remembering.
//
// TWO-WAY, WHICH IS THE PART THAT IS EASY TO GET WRONG. Opening pushes a marker
// entry; Back pops it and closes; closing by any other means — the ×, Escape, the
// scrim, a save that dismisses the dialog — has to CONSUME the marker, or every
// dialog opened and closed normally leaves a dead entry behind and the page's own
// Back stops working after the third one.
//
// `closedByPop` is what tells those apart, and the cleanup is where the consuming
// happens rather than in the close handler: an overlay can be unmounted by its
// parent without anybody calling onClose, and that still owes the entry back.
// The guard on our own marker matters for the same reason — if the parent
// navigated, the entry on top is no longer ours and calling back() would undo the
// navigation instead.
export function useBackToClose(active, onClose) {
  useEffect(() => {
    if (!active) return;
    let closedByPop = false;
    // The depth App keeps in history.state is carried forward rather than
    // replaced. pushState REPLACES the state object, so a marker that spelled
    // only its own flag would blank the number the in-app Back reads to tell
    // "there is a screen behind this" from "the reader arrived here directly".
    window.history.pushState({ ...window.history.state, tpOverlay: true }, "");
    const onPop = () => {
      closedByPop = true;
      onClose?.();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!closedByPop && window.history.state?.tpOverlay) window.history.back();
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ---- cards & buttons (§6) ----

const HAND_RADII = ["", "hc-r1", "hc-r2", "hc-r3"];

// HandCard — sheen bg, ink border, offset shadow; vary `variant` (0–3) per
// instance for uneven radii; `colorBar` adds the annotation-colour left bar.
export function HandCard({
  variant = 0,
  colorBar,
  className = "",
  style,
  children,
  ...rest
}) {
  const bar = colorBar
    // categoryVar, not a copied hex: --hl-N is what a recoloured category
    // updates, so a card repaints itself the moment the setting changes rather
    // than on the next full reload.
    ? { borderLeft: `4px solid ${categoryVar(colorBar) || colorBar}` }
    : undefined;
  return (
    <div
      className={`hand-card ${HAND_RADII[variant % HAND_RADII.length]} ${className}`}
      style={bar ? { ...bar, ...style } : style}
      {...rest}
    >
      {children}
    </div>
  );
}

// Card — the plain settings/account panel: a hand-card with uniform padding and
// nothing else (no variant rotation or colour bar, unlike HandCard). `pad` is a
// Tailwind padding class so each surface keeps its own rhythm (Settings p-6,
// Account p-5).
export function Card({ pad = "p-6", className = "", children, ...rest }) {
  return <div className={`hand-card ${pad} ${className}`.trim()} {...rest}>{children}</div>;
}

// BulkBar — the accent action strip shown above a selectable list: a "N
// selected" count, the caller's action controls (as children), and a Clear
// button pinned to the right. Renders nothing when nothing is selected. Shared
// by the Metadata console and Search table bulk actions.
export function BulkBar({ n, onClear, children }) {
  if (n === 0) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3 py-2"
      style={{
        background: "color-mix(in srgb, var(--accent) 8%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent) 30%, var(--line))",
        borderRadius: 9,
      }}
    >
      <MonoLabel style={{ color: "var(--accent-ui)" }}>{t("common.selection.count", { count: n, n })}</MonoLabel>
      {children}
      <FieldIconButton
        icon={<IconClose />}
        ariaLabel={t("common.selection.clear.aria")}
        onClick={onClear}
        wrapClassName="ml-auto"
      />
    </div>
  );
}

// PlayfulButton is the shared base: it plays a random button animation on click
// (its own carousel) then calls through to the caller's onClick. `base` is the
// style class (btn-sticker / btn-film / tp-btn-ghost).
//
// `icon` puts a glyph before the words and wraps the words in .btn-label, which
// is the span html[data-labels="off"] clips. A call site therefore becomes
// icon-only by gaining one prop, and the collapse itself costs no JS. The words
// are clipped rather than display:none'd, so they stay in the accessibility
// tree — an icon-only row still reads as "Share, Edit, Delete" to a screen
// reader instead of three unnamed buttons, and no aria-label has to be bolted
// on and then kept in sync with the visible text.
//
// `keepLabel` opts out of the collapse. Primary submits and destructive
// confirms keep their words at every width: a glyph is a thing you learn, and
// neither "save this" nor "delete this permanently" is something a person
// should have to have learned already. A keepLabel button may still take an
// icon — the glyph helps you find it, the words say what it does.
//
// Note which condition sets `has-btn-icon`: it marks a button whose words CAN
// disappear, not one that merely has a glyph. That class is what squares the
// button to 44px under data-labels="off", so a keepLabel button carrying it
// would be crushed to icon width with its words still inside.
//
// `has-fixed-label` is its counterpart and marks the other case — a glyphed
// button whose words are held BY AN EXCEPTION rather than by the preference. It
// squares under an explicit "Hide" only (see index.css), because keepLabel is
// the app's default about which words are worth the room and a reader who has
// asked for glyphs has already answered that. Two classes rather than one with
// two meanings: `has-btn-icon` must keep matching only the collapsible buttons,
// or `[data-labels="off"]` would square the opt-outs with their words inside —
// the bug this comment was originally written about.
function PlayfulButton({ base, className = "", icon, keepLabel, onClick, children, ...rest }) {
  const { play, animClass, onAnimationEnd } = usePlayful("anim-btn", 3);
  return (
    <button
      {...rest}
      className={`tp-btn tactile ${base} ${animClass}${icon && !keepLabel ? " has-btn-icon" : ""}${icon && keepLabel ? " has-fixed-label" : ""} ${className}`}
      onClick={(e) => {
        play();
        onClick?.(e);
      }}
      onAnimationEnd={onAnimationEnd}
    >
      {icon ? (
        <>
          <span className="btn-icon">{icon}</span>
          <span className={keepLabel ? "btn-label-fixed" : "btn-label"}>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function StickerButton(props) {
  return <PlayfulButton base="btn-sticker" {...props} />;
}
export function FilmButton(props) {
  return <PlayfulButton base="btn-film" {...props} />;
}
export function GhostButton(props) {
  return <PlayfulButton base="tp-btn-ghost" {...props} />;
}

// ---- glossary declarations -------------------------------------------------
//
// A `glossary.demo` beside a component is what makes docs/ui-glossary.html render THAT
// COMPONENT rather than a copy of its markup. The page used to hand-write every sample,
// which is how it went on showing a topbar with an Import tab that routes.js had already
// dropped: a picture of a component cannot go stale loudly.
//
// The link is the entry's own `src` line, which already names the component — so there is
// nothing to register and nothing to keep in step. Add a demo here and that entry starts
// rendering live on the next `make glossary`; leave it off and the entry keeps the markup
// carried over from the old page. glossary-registry.test.js counts what is still carried,
// and the count is only allowed to fall.
//
// Keep a demo to the HARD case rather than the flattering one — a long name, two authors,
// an empty cover — because a sample that fits proves nothing.
//
// WRAPPED IN `import.meta.env.DEV`, AND THAT IS NOT A DETAIL. These are documentation
// fixtures: a reader of the app has no use for the string "Add book", and measured, six
// of them added 228 bytes to the shipped bundle — about 6KB once every component has
// one. The release that split this bundle into per-screen chunks did so to stop sending
// people code they never run, and doc samples are exactly that. Vite replaces the flag
// with `false` in a production build and drops the block; the generator runs against the
// dev server, where it is true, so it still sees every declaration.
if (import.meta.env.DEV) {
  StickerButton.glossary = { demo: (h) => h(StickerButton, null, "Add book") };
  FilmButton.glossary = { demo: (h) => h(FilmButton, null, "Sign in") };
  GhostButton.glossary = { demo: (h) => h(GhostButton, null, "Export") };
}

// ---- type bits (§3) ----

export function MonoLabel({ className = "", children, ...rest }) {
  return (
    <span className={"mono-label " + className} {...rest}>
      {children}
    </span>
  );
}
export function Kicker({ className = "", children, ...rest }) {
  return (
    <span className={"kicker " + className} {...rest}>
      {children}
    </span>
  );
}
if (import.meta.env.DEV) {
  MonoLabel.glossary = { demo: (h) => h(MonoLabel, null, "CH. 3 · P.142") };
  Kicker.glossary = { demo: (h) => h(Kicker, null, "a marginal annotation") };
}

// PageHeader — Newsreader 24 title + mono counts + right-side actions (§7).
export function PageHeader({ title, counts, right }) {
  return (
    <header className="page-header">
      <div className="ph-left">
        <h1>{title}</h1>
        {counts && <MonoLabel>{counts}</MonoLabel>}
      </div>
      {right && (
        <div className="flex flex-wrap items-center gap-3">{right}</div>
      )}
    </header>
  );
}

// SectionHead — a page header, or the same words one level down.
//
// Checks is one screen made of two pages that were screens of their own, and
// each still has to work at both ranks: on its own URL it IS the page and takes
// an <h1>; inside Checks it is a section under the page's <h1> and takes an
// <h2>. A page with two <h1>s is not a style problem, it is a document with two
// titles, and a screen reader reads it as two documents.
//
// One component rather than a conditional at each of the four call sites: the
// two pages would otherwise disagree about what "embedded" changes the first
// time one of them grows a fourth header.
export function SectionHead({ embedded = false, title, counts, right }) {
  if (!embedded) return <PageHeader title={title} counts={counts} right={right} />;
  return (
    <header className="section-header">
      <div className="ph-left">
        <h2>{title}</h2>
        {counts && <MonoLabel>{counts}</MonoLabel>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-3">{right}</div>}
    </header>
  );
}
// Wrapped, like every other demo here — see the note above the first one.
if (import.meta.env.DEV) {
  SectionHead.glossary = {
    demo: (h) => h(SectionHead, { embedded: true, title: "Stray marks", counts: "3 findings" }),
  };
}

// Field — mono label above a themed input (§8 form pattern).
// `nameCase` marks a box that holds a NAME — a person, a title, a series, a
// character — and asks the phone's keyboard to offer a capital at the start of
// every word. It is a hint and not a rule: press shift and "The Wheel of Time" or
// "bell hooks" is what gets stored. See "name casing" below for why nothing here
// rewrites the value any more.
// `inputRef` is named rather than taken as `ref`, because Field is a plain
// function component: a `ref` on it would attach to nothing and fail silently,
// which is exactly how a caller ends up focusing an element that never moves.
// Pulled out of `rest` for the same reason every other named prop is — anything
// left in there is spread onto the <input> and would land as a DOM attribute.
export function Field({ label, className = "", nameCase = false, onChange, inputRef, ...rest }) {
  return (
    <label className={"tp-field " + className}>
      <MonoLabel>{label}</MonoLabel>
      <input
        className="tp-input"
        ref={inputRef}
        // Before `rest`, so a caller that needs something else can still say so.
        autoCapitalize={nameCase ? "words" : undefined}
        {...rest}
        onChange={onChange}
      />
    </label>
  );
}

// NameInput is Field's bare twin for the forms that lay out their own inputs
// rather than using a labelled Field — same keyboard hint, same event shape.
export function NameInput({ onChange, ...rest }) {
  return (
    <input
      className="tp-input"
      autoCapitalize="words"
      {...rest}
      onChange={onChange}
    />
  );
}

// ---- partial dates (§3f) ----------------------------------------------------
// A date you actually know, to whatever precision you actually know it: a bare
// year, a year and month, or a full day. "I read it in 2019" is a real answer,
// and padding it to 2019-01-01 would invent a precision nobody has. Stored as
// the string the user chose — 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' — which is also
// what the server validates and what sorts correctly as text.

// Keys rather than words, resolved at draw time: this table is built at import,
// before the language is known. The order IS the calendar and never changes.
//
// Exported because the stats calendar's x axis needs the same twelve short names
// the date picker shows. It used to cut the FULL month name to three characters,
// which agreed with this table only in English and only by luck.
export const MONTH_KEYS = [
  "common.month.jan.label", "common.month.feb.label", "common.month.mar.label",
  "common.month.apr.label", "common.month.may.label", "common.month.jun.label",
  "common.month.jul.label", "common.month.aug.label", "common.month.sep.label",
  "common.month.oct.label", "common.month.nov.label", "common.month.dec.label",
];

// isPartialDate mirrors normalizePartialDate on the server: the three shapes,
// plus a real calendar's bounds so a typed "2019-13" is caught before saving.
export function isPartialDate(v) {
  if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  if (y < 1000 || y > 3000) return false;
  if (m != null && (m < 1 || m > 12)) return false;
  if (d != null && (d < 1 || d > daysInMonth(y, m))) return false;
  return true;
}

// formatPartialDate renders a stored value for reading: "2019", "Mar 2019",
// "4 Mar 2019". The precision shows, which is the point of keeping it.
export function formatPartialDate(v) {
  if (!v) return "";
  const [y, m, d] = v.split("-").map(Number);
  if (!m) return String(y);
  if (!d) return t("common.date.month-year.label", { month: t(MONTH_KEYS[m - 1]), year: y });
  return t("common.date.full.label", { day: d, month: t(MONTH_KEYS[m - 1]), year: y });
}

// todayPartial is the full date today, the default every date prompt opens with.
export function todayPartial() {
  const n = new Date();
  const p = (x) => String(x).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// DatePicker — the calendar behind PartialDateField. Three views the user drills
// through, and each level is a legal stopping point: pick a year and you have a
// year; carry on and pick a month and you have a month; pick a day for the lot.
// That is what makes it a PARTIAL date picker rather than a day picker you have
// to fight when you only know the year.
//
// `granularity` caps the drill-down: 'day' (default) allows all three, 'month'
// stops at a month, 'year' offers only years.
function DatePicker({ value, onPick, onClose, granularity = "day" }) {
  const parsed = /^\d{4}/.test(value || "") ? (value || "").split("-").map(Number) : [];
  const now = new Date();
  const [year, setYear] = useState(parsed[0] || now.getFullYear());
  const [month, setMonth] = useState(parsed[1] || null);
  // Which grid is showing. Opening on an existing value lands on the level that
  // value already has, so correcting a day does not start from the decade.
  const [view, setView] = useState(() => {
    if (granularity === "year") return "year";
    if (granularity === "month") return parsed[0] ? "month" : "year";
    if (parsed[1]) return "day";
    return parsed[0] ? "month" : "year";
  });
  // The 12-year page the year grid is showing, floored to a decade boundary.
  const [yearPage, setYearPage] = useState(() => Math.floor((parsed[0] || now.getFullYear()) / 12) * 12);

  const pick = (v) => {
    onPick(v);
    onClose();
  };
  const cell = (label, active, onClick, key) => (
    <button
      key={key ?? label}
      type="button"
      className={`menu-item${active ? " active" : ""}`}
      style={{ justifyContent: "center", padding: "7px 4px", fontSize: 'var(--type-ui-13)' }}
      onClick={onClick}
    >
      {label}
    </button>
  );
  const head = (title, onPrev, onNext, onUp) => (
    <div className="mb-1.5 flex items-center gap-1">
      {onPrev && (
        <Tooltip label={t("common.date.picker.prev.tip")}>
          <button type="button" className="tp-btn tp-btn-ghost" style={{ padding: "2px 8px" }} onClick={onPrev} aria-label={t("common.date.picker.prev.aria")}>
            ‹
          </button>
        </Tooltip>
      )}
      <Tooltip label={onUp ? t("common.date.picker.up.tip") : null} className="flex-1">
        <button
          type="button"
          className="mono-label"
          style={{ flex: 1, background: "none", border: "none", cursor: onUp ? "pointer" : "default", padding: "4px 0" }}
          onClick={onUp || undefined}
        >
          {title}
        </button>
      </Tooltip>
      {onNext && (
        <Tooltip label={t("common.date.picker.next.tip")}>
          <button type="button" className="tp-btn tp-btn-ghost" style={{ padding: "2px 8px" }} onClick={onNext} aria-label={t("common.date.picker.next.aria")}>
            ›
          </button>
        </Tooltip>
      )}
    </div>
  );
  return (
    <div className="hand-card hc-r2 date-picker" role="dialog" aria-label={t("common.date.picker.aria")}>
      {view === "year" && (
        <>
          {head(t("common.date.picker.year-range.title", { a: yearPage, b: yearPage + 11 }), () => setYearPage((p) => p - 12), () => setYearPage((p) => p + 12))}
          <div className="date-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {Array.from({ length: 12 }, (_, i) => yearPage + i).map((y) =>
              cell(y, y === parsed[0], () => {
                setYear(y);
                if (granularity === "year") return pick(String(y));
                setView("month");
              }),
            )}
          </div>
        </>
      )}
      {view === "month" && (
        <>
          {head(String(year), () => setYear((y) => y - 1), () => setYear((y) => y + 1), () => setView("year"))}
          <div className="date-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {MONTH_KEYS.map((monthKey, i) =>
              cell(t(monthKey), year === parsed[0] && i + 1 === parsed[1], () => {
                setMonth(i + 1);
                if (granularity === "month") return pick(`${year}-${String(i + 1).padStart(2, "0")}`);
                setView("day");
              }),
            )}
          </div>
          {/* The whole point of the control: stop here and keep just the year. */}
          <button type="button" className="date-coarse" onClick={() => pick(String(year))}>
            {t("common.date.picker.just-year.label", { year })}
          </button>
        </>
      )}
      {view === "day" && (
        <>
          {head(t("common.date.month-year.label", { month: t(MONTH_KEYS[(month || 1) - 1]), year }), null, null, () => setView("month"))}
          <div className="date-grid" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
            {Array.from({ length: daysInMonth(year, month || 1) }, (_, i) => i + 1).map((d) =>
              cell(
                d,
                year === parsed[0] && month === parsed[1] && d === parsed[2],
                () => pick(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`),
              ),
            )}
          </div>
          <button
            type="button"
            className="date-coarse"
            onClick={() => pick(`${year}-${String(month || 1).padStart(2, "0")}`)}
          >
            {t("common.date.picker.just-month.label", { month: t(MONTH_KEYS[(month || 1) - 1]), year })}
          </button>
        </>
      )}
    </div>
  );
}

// PartialDateField — a labelled date input you can either type into or pick from
// the calendar beside it. Typing is validated on change and flagged inline rather
// than blocked, so a half-typed "2019-0" is not fought with mid-keystroke.
//
// value / onChange speak the stored string. `granularity` caps the picker (see
// DatePicker); 'year' turns it into a year chooser, which is what a person's
// birth year wants.
export function PartialDateField({
  label,
  value,
  onChange,
  granularity = "day",
  placeholder,
  hint,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  // The picker is a fixed 244px card, so it keeps its own width. minHeight is
  // generous because a calendar that scrolls is worse than one that overlaps.
  const { popRef, style } = useAnchoredPosition(open, ref, { minHeight: 240 });
  useDismiss(open, () => setOpen(false), [ref, popRef]);
  const bad = !!value && !isPartialDate(value);
  const ph = placeholder || t(granularity === "year" ? "common.field.year.placeholder" : "common.field.date.placeholder");
  return (
    <label className={"tp-field " + className}>
      {label && <MonoLabel>{label}</MonoLabel>}
      <span className="relative flex items-center gap-2" ref={ref}>
        <input
          className="tp-input"
          value={value || ""}
          inputMode="numeric"
          placeholder={ph}
          maxLength={10}
          aria-invalid={bad || undefined}
          // Only digits and the separator can be typed: it keeps the value in the
          // stored shape without needing to reject whole words on save.
          onChange={(e) => onChange(e.target.value.replace(/[^\d-]/g, "").slice(0, 10))}
          style={bad ? { borderColor: "var(--error)" } : undefined}
        />
        <Tooltip label={t("common.date.pick.tip")} className="shrink-0">
          <button
            type="button"
            className="tp-btn tp-btn-ghost tactile"
            style={{ padding: "6px 9px", flex: "none" }}
            aria-label={t("common.date.pick.aria", { field: label || t("common.date.pick.field.fallback") })}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <IconCalendar />
          </button>
        </Tooltip>
        {open && createPortal(
          <span ref={popRef} className="date-pop" style={style}>
            <DatePicker value={value} granularity={granularity} onPick={onChange} onClose={() => setOpen(false)} />
          </span>,
          document.body,
        )}
      </span>
      {(bad || hint) && (
        <span style={{ display: "block", marginTop: 5, fontSize: 'var(--type-ui-12)', lineHeight: 1.4, color: bad ? "var(--error)" : "var(--faint)" }}>
          {bad ? t("error.validate.partial-date") : hint}
        </span>
      )}
    </label>
  );
}

// MultiSelect — a dropdown you can tick more than one row in, wearing the same
// trigger/panel skin as Select so the filter row stays of one piece. No selection
// means "everything", which is what a filter with nothing chosen should mean, so
// there is no separate All row to keep in sync.
export function MultiSelect({ values = [], onChange, options, ariaLabel, allLabel = "all", width }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { popRef, style } = useAnchoredPosition(open, ref, { matchWidth: "min", minHeight: 140 });
  useDismiss(open, () => setOpen(false), [ref, popRef]);
  const picked = options.filter(([v]) => values.includes(v));
  const label = picked.length === 0 ? allLabel : picked.length === 1 ? picked[0][1] : `${picked.length} states`;
  const toggle = (v) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <span className="tp-select" ref={ref} style={width ? { width } : undefined}>
      <button
        type="button"
        className="tp-select-trigger tactile"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={picked.length ? "" : "tp-select-ph"}>{label}</span>
        <span className="tp-select-chev" aria-hidden="true">
          <IconChevron size={16} />
        </span>
      </button>
      {open && createPortal(
        <span ref={popRef} className="hand-card hc-r2 tp-select-panel tp-multi" role="listbox" aria-multiselectable="true" style={style}>
          {options.map(([v, text, swatch]) => {
            const on = values.includes(v);
            return (
              <button
                key={v}
                type="button"
                role="option"
                aria-selected={on}
                className={`menu-item${on ? " active" : ""}`}
                onClick={() => toggle(v)}
              >
                <span aria-hidden="true" style={{ width: 14, flex: "none", display: "inline-flex", justifyContent: "center" }}>
                  {on ? <IconCheck size={13} /> : null}
                </span>
                {swatch && (
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: swatch, flex: "none" }} />
                )}
                {text}
              </button>
            );
          })}
          {values.length > 0 && (
            <button type="button" className="menu-item" style={{ color: "var(--soft)" }} onClick={() => onChange([])}>
              <span aria-hidden="true" style={{ width: 14, flex: "none" }} />
              clear
            </button>
          )}
        </span>,
        document.body,
      )}
    </span>
  );
}

// ---- tags (§6): five CSS-only styles × four colours ----
// `style` here is the tag style name (sticker|banner|flyout|tape|reel), not a
// React style object — it is consumed, never forwarded to the DOM.
export function TagChip({
  color = "yellow",
  style = "sticker",
  className = "",
  children,
  ...rest
}) {
  return (
    <span className={`tag-chip tc-${color} ts-${style} ${className}`} {...rest}>
      {children}
    </span>
  );
}

export function HighlightSpan({ children }) {
  return <mark className="hl">{children}</mark>;
}

// HandNote — Caveat + accent tick on paper; Newsreader italic on film (§3/§6).
// A NOTE ALWAYS FOLDS AT TWO LINES, and the pack's reason is the whole of it: "it
// is a margin remark, not a second quote — if it needs more room than the thing it
// annotates, it is an annotation of its own." Unfolded, a paragraph-length note
// printed in full in 19px hand type and was routinely taller than the quote it
// was about, which inverts the card.
//
// `lines` is a prop because one caller genuinely differs: the quiz card's note is
// the thing being read rather than a remark beside it.
// ClampToggle — the chevron under a clamped block, with the sentence that says
// which way it goes.
//
// FOUR LINES, WRITTEN TWICE, VERBATIM. `HandNote` and `ExpandableText` both ended
// with the same guard, the same Tooltip with the same two locale keys and the
// same layout classes, and the app has exactly one affordance for expanding a
// clamped block — "a small chevron; there are no 'show more / show less' text
// buttons anywhere". Two copies of one affordance is two places its label has to
// stay right, and only one of them would have been found the day the wording
// changed.
function ClampToggle({ canToggle, open }) {
  if (!canToggle) return null;
  return (
    <Tooltip
      label={t(open ? "common.action.show-less.label" : "common.clamp.text.more.tip")}
      side="bottom"
      className="flex w-full justify-center"
    >
      <ClampMore open={open} />
    </Tooltip>
  );
}

export function HandNote({ className = "", lines = 2, children }) {
  const [open, setOpen] = useState(false)
  const { ref, canToggle, clamp } = useClamped({ lines, open, watch: children })
  return (
    // card-text: the margin note is prose too, and a long press over it selects
    // words rather than the card. See ExpandableText.
    //
    // THE CLAMP IS ON THE <p> AND THE CONTROL IS ON A WRAPPER, which is the shape
    // the other three clamped blocks take: a -webkit-box cannot hold a chevron
    // beside its own text without the chevron counting as one of the lines.
    <div
      className={`clampable${canToggle ? ' is-clickable' : ''}`}
      aria-expanded={canToggle ? open : undefined}
      {...clampProps(canToggle, () => setOpen((o) => !o))}
    >
    <p ref={ref} style={clamp || undefined} className={"hand-note card-text " + className}>
      {/* AN EMPTY SPAN, DRAWN BY CSS. It used to carry a literal ▍ (U+258D LEFT
          FIVE EIGHTHS BLOCK) as text, which is three bets at once: that the
          reader's font has that glyph, that it draws it as a solid bar rather
          than a hollow or half-width one, and that it scales with the type dial
          the way a RULE should — which it does not, because it is a letter. A
          font without it renders tofu beside every margin note in the library.
          The pack replaced it with a drawn 2px rule for exactly that reason. */}
      <span className="tick" aria-hidden="true" />
      {children}
    </p>
      <ClampToggle canToggle={canToggle} open={open} />
    </div>
  );
}

// TranslationLine — what the line SAYS, under the meta strip and above the note.
//
// ONE COMPONENT FOR ALL THREE KINDS, and that is the point of it living here.
// The rich form of utteranceMeta drew this itself from 0035 until 0051, which
// meant a standalone quote showed its translation and the two kinds most
// libraries are made of had nowhere to show one — and it also meant the search
// modal, which asks utteranceMeta for its STRING form, showed no translation for
// a quote either. Three cards drawing one field is three chances to draw it
// differently.
//
// PROSE, NOT A LOCATOR, which is what decides the voice: it is set in the display
// face rather than the mono strip it sits under, because it is the same words in
// another language and not another thing to know about them. Italic separates it
// from the quote without making it a second quote.
//
// NOT the mono face, and that is load-bearing rather than aesthetic: the mono
// stack has no Indic member (see src/locale.jsx), so a Bengali translation set in
// it would draw in whatever the OS reached for — which is the same trap
// .cleanup-snippet documents.
export function TranslationLine({ className = "", children }) {
  // card-text for the reason HandNote carries it: this is prose, so a long press
  // over it should select words rather than the card.
  return <p className={"quote-translation card-text " + className}>{children}</p>;
}

// ---- ♥ favourite mark (§6: hearts for favourites, never stars) ----

// randWobble is the ink-mark jitter (§1: user marks are "hand-drawn: tilted,
// uneven, inked" — never machine-perfect). It returns CSS vars for a random
// rotation, scale and vertical nudge so no two hearts sit quite alike;
// memoise it per glyph so the jitter holds still for the life of the mount, the
// way frame codes do. The CSS composes --grot/--gscale/--gdy into one transform
// and reduced-motion neutralises it.
export function randWobble(rotDeg = 11, dyPx = 1.3) {
  const rot = (Math.random() * 2 - 1) * rotDeg;
  const scale = 0.85 + Math.random() * 0.32;
  const dy = (Math.random() * 2 - 1) * dyPx;
  return {
    "--grot": `${rot.toFixed(1)}deg`,
    "--gscale": scale.toFixed(3),
    "--gdy": `${dy.toFixed(1)}px`,
  };
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// usePlayful gives an element a small animation "carousel" (§6): play() picks one
// of `count` CSS variants at random (`${prefix}-1..N`) so repeated taps never feel
// canned, and clears it on animationend so it can re-fire. No-ops under
// reduced-motion. Spread the returned className + onAnimationEnd onto the element.
export function usePlayful(prefix, count = 3) {
  const [cls, setCls] = useState("");
  const play = () => {
    if (prefersReducedMotion()) return;
    setCls(`${prefix}-${1 + Math.floor(Math.random() * count)}`);
  };
  return { play, animClass: cls, onAnimationEnd: () => setCls("") };
}

// FavBadge — a non-interactive ♥ overlay for the corner of a favourited
// cover/poster (the card itself is the clickable element, so this can't be a
// button). Drop-shadowed so it reads over any artwork, and hand-tilted.
export function FavBadge() {
  const wob = useMemo(() => randWobble(13, 0), []);
  return (
    <span
      aria-label={t("common.favourite.badge.aria")}
      className="absolute right-1.5 top-1.5"
      style={{
        ...wob,
        color: "#ef5a5a",
        fontSize: 'var(--type-ui-19)',
        lineHeight: 1,
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,.55))",
        transform: "rotate(var(--grot)) scale(var(--gscale))",
      }}
    >
      <IconHeartOn size={16} />
    </span>
  );
}

// SHELF_META — every shelf state a work can be in, with the colour that stands
// for it and the words the two sides use. One table so the bar under a cover, the
// chip on a detail, the filter dropdown and the cap dialog can never drift apart.
//
// Colours follow Radarr's convention (blue in flight, green done, red given up,
// amber held) using tokens already in the palette. Note --accent (terracotta) is
// deliberately NOT used for 'reading': it sits a few degrees from --error, and a
// bar you have to squint at to tell "reading" from "abandoned" is no bar at all.
//
//   wishlist   derived: nothing quoted from it yet
//   reading    books, in progress · watching  films and shows, in progress
//   paused     started, set down for now
//   abandoned  given up on
//   completed  read/watched to the end
export const SHELF_BLUE = "#7FA6C9";
//
// `book` and `movie` hold KEYS. The two in-progress spellings share one pair of
// keys because they are one shelf state under two stored words, and a second key
// saying "Reading" again is a second place for it to drift.
export const SHELF_META = {
  wishlist: { color: "var(--faint)", book: "common.shelf.wishlist.book.label", movie: "common.shelf.wishlist.film.label" },
  reading: { color: SHELF_BLUE, book: "common.shelf.reading.book.label", movie: "common.shelf.reading.film.label" },
  watching: { color: SHELF_BLUE, book: "common.shelf.reading.book.label", movie: "common.shelf.reading.film.label" },
  // A game is played. Same blue as the other two in-progress words, because the
  // colour means "in flight" rather than "a film"; the word is what differs.
  // Both sides read "Playing" — a game only ever lives on the catalogue side, so
  // there is no book wording for it to fall back to.
  playing: { color: SHELF_BLUE, book: "common.shelf.playing.book.label", movie: "common.shelf.playing.film.label" },
  paused: { color: "var(--amber)", book: "common.shelf.paused.book.label", movie: "common.shelf.paused.film.label" },
  abandoned: { color: "var(--error)", book: "common.shelf.abandoned.book.label", movie: "common.shelf.abandoned.film.label" },
  completed: { color: "var(--ok)", book: "common.shelf.completed.book.label", movie: "common.shelf.completed.film.label" },
};

// IN_FLIGHT_STATES are the shelf states that mean "started, not finished" — the
// ones StatusBar draws as a partial progress bar rather than a solid strip.
// Every settled state is solid; there is no partial "completed".
export const IN_FLIGHT_STATES = new Set(["reading", "watching", "playing"]);

// shelfLabel is the word one side uses for a state ('reading' vs 'watching').
//
// THE BOOKS SIDE IS THE ONE THAT HAS TO BE NAMED, not the other way round. This
// tested `kind === "movie"`, which is correct for the two words a board passes
// and wrong for everything a ROW answers: capKeyFor says 'show' or 'game' for a
// catalogue row, and both of those fell through to the book wording — so a show
// handed straight to this function would have been read out as "Reading". The
// in-progress word is the only one that differs at all (paused, abandoned and
// completed are one word for every medium), and a game's differs by STATE rather
// than by side, since SHELF_META.playing says "Playing" on both.
export function shelfLabel(state, kind = "book") {
  const m = SHELF_META[state];
  return m ? t(kind === "book" ? m.book : m.movie) : "";
}

// StatusBar — the shelf state as a colour bar directly UNDER a cover or poster,
// the way Radarr marks a library tile. It never overlaps the artwork: the whole
// cover stays visible and the bar is its own strip below, so nothing is hidden
// behind a status.
//
// In flight (reading/watching) the bar is a PROGRESS bar, filled to `progress`
// with the rest of the track a dim wash of the same blue — so how far in you are
// reads from across the board. Every settled state is a solid strip: there is no
// partial "completed".
//
// `radius` rounds the bottom corners to match the artwork above it (posters have
// an 8px radius; a book's hand-drawn card clips its own shape, so it passes 0).
//
// `kind` IS THE MEDIUM THE WORD COMES FROM, and it used to be missing entirely:
// every caller drew the bar without one, so shelfLabel's default applied and the
// strip under a film you are watching was announced — to a screen reader, and in
// its tooltip — as "Reading — 40%". Nothing shows on screen, which is why it
// survived: the bar is a colour, and the word is only ever heard.
export function StatusBar({ state, kind = "book", progress = 0, radius = 0, title }) {
  const meta = SHELF_META[state];
  if (!meta) return null;
  // IN_FLIGHT_STATES rather than a two-way ||, which is what this was: adding
  // 'playing' to the vocabulary without adding it here would have drawn a game's
  // progress bar as a solid finished strip at 100% — no error, just a game that
  // looks completed the moment you start it.
  const inFlight = IN_FLIGHT_STATES.has(state);
  const pct = inFlight ? Math.max(0, Math.min(100, progress)) : 100;
  const label =
    title ||
    (inFlight && pct > 0
      ? t("common.shelf.progress.label", { name: shelfLabel(state, kind), percent: pct })
      : shelfLabel(state, kind));
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      style={{
        height: 5,
        // The unfilled track is the state's own colour at low opacity rather
        // than a neutral grey, so a barely-started book still reads as "reading"
        // and not as an empty slot.
        background: `color-mix(in srgb, ${meta.color} 22%, transparent)`,
        borderBottomLeftRadius: radius,
        borderBottomRightRadius: radius,
        overflow: "hidden",
      }}
    >
      <div style={{ width: `${pct}%`, height: "100%", background: meta.color, transition: "width .3s ease" }} />
    </div>
  );
}

// ReadingBadge — the one icon that survived onto the artwork: an open book (or a
// play triangle for film) on a work you are in the middle of, so the live rows
// stand out on a board where every other state is carried by its bar alone.
// Non-interactive, like FavBadge — the tile itself is the clickable element.
//
// `stacked` drops it below the film grid's "SHOW" chip, which claims the same
// corner on a show's poster.
//
// It was a bare blue glyph carrying a dark blur halo, which is the trick that
// fails at exactly the size it mattered: a halo is a soft gradient, so at the
// ~18px a phone cover gives it, it ate the thin strokes it existed to protect
// and the mark read as a smudge on anything but plain artwork. It is an OPAQUE
// disc now — shelf blue, white glyph, hard rim — so the contrast comes from an
// edge that does not scale away, and the badge reads over busy art and pale art
// alike. It also stops being the one thing in the app with a glow.
//
// `kind` IS A MEDIUM, NOT A BOARD — capKeyFor's answer ('book' | 'movie' |
// 'show' | 'game'), asked of the ROW by whoever draws the tile. It used to be a
// two-way `kind !== "movie"` split fed the Catalogue's literal 'movie' for every
// tile it deals, so a game you are playing wore a badge whose accessible name
// was "Currently watching" — the badge is a glyph, so the wrong word was audible
// and never visible.
//
// A game keeps the play triangle. There is no gamepad glyph in this set, and a
// triangle is what "playing" is drawn as everywhere else in the app; inventing an
// icon for one badge is a design change, not a bug fix. Only the word changes.
export function ReadingBadge({ kind = "book", stacked = false }) {
  const wob = useMemo(() => randWobble(11, 0), []);
  // Named positively, both of them: anything that is not a book or a game is
  // watched, which is what keeps a show on the film wording instead of falling
  // through to the book one the way the old `!== "movie"` did.
  const isBook = kind === "book";
  const isGame = kind === "game";
  const label = t(
    isGame ? "common.reading-badge.game.aria" : isBook ? "common.reading-badge.book.aria" : "common.reading-badge.film.aria",
  );
  return (
    <span
      aria-label={label}
      title={label}
      className="absolute left-1.5 reading-badge"
      style={{
        ...wob,
        top: stacked ? 26 : 6,
        background: SHELF_BLUE,
        transform: "rotate(var(--grot))",
      }}
    >
      {/* isGame is computed above for the aria-label and was then dropped here, so a
          game announced itself as a game and drew the film glyph. Three activities,
          three silhouettes — which is the whole reason the shelf marks exist. */}
      {isGame ? <IconPlaying size={15} /> : isBook ? <IconReading size={15} /> : <IconWatching size={15} />}
    </span>
  );
}

// StateTag — a shelf state as an interactive chip, for the detail hero beside the
// hearts. Clicking opens a popover under it: the transitions menu for a state you
// set, or a one-line explanation for the derived wishlist tag. `children` may be
// a function receiving `close`, for popovers whose items dismiss it.
export function StateTag({ state, label, tip, className = "", quiet = false, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  // Left-aligned, unlike MoreMenu: this chip sits at the start of a row, and
  // it hosts the read-log editor, so its content is a form rather than a list
  // and wants a generous minimum.
  const { popRef, style } = useAnchoredPosition(open, ref, { align: "start", minHeight: 160 });
  const close = () => setOpen(false);
  useDismiss(open, close, [ref, popRef], {
    onEscape: () => ref.current?.querySelector("button")?.focus(),
  });
  // The chip is swatched in the same colour as the bar under the cover, so the
  // detail and the board are speaking about the same thing.
  const color = (SHELF_META[state] || {}).color || "var(--soft)";
  return (
    <span className={`relative ${className}`.trim()} ref={ref} style={{ display: "inline-flex" }}>
      <Tooltip label={tip} side="bottom">
        <button
          type="button"
          className="tp-chip tp-chip-btn"
          style={quiet ? { gap: 6 } : { gap: 6, color, borderColor: "color-mix(in srgb, currentColor 45%, transparent)" }}
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen((o) => !o)}
        >
          {/* The swatch is the shelf's colour said a second time. Where this chip
              is NOT about the shelf state — the compact header's last-read date —
              a coloured square in front of a date is a colour with no referent. */}
          {!quiet && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: color, flex: "none" }} />}
          {label}
        </button>
      </Tooltip>
      {open && createPortal(
        <div
          ref={popRef}
          className="hand-card hc-r2 more-menu"
          style={{ ...style, minWidth: 210, maxWidth: 280 }}
          role="menu"
        >
          {typeof children === "function" ? children(close) : children}
        </div>,
        document.body,
      )}
    </span>
  );
}

export function Hearts({ value, onChange }) {
  const wob = useMemo(() => randWobble(9, 1), []);
  const { play, animClass, onAnimationEnd } = usePlayful("anim-heart", 3);
  return (
    <Tooltip label={t(value ? "common.action.favourite.off.label" : "common.action.favourite.on.label")}>
      <button
        type="button"
        className={`heart ${animClass}${value ? " on" : ""}`}
        style={wob}
        aria-pressed={!!value}
        onAnimationEnd={onAnimationEnd}
        onClick={
          onChange
            ? () => {
                play();
                onChange(!value);
              }
            : undefined
        }
      >
        {value ? <IconHeartOn size={18} /> : <IconHeart size={18} />}
      </button>
    </Tooltip>
  );
}


// ---- cover/poster grid size (persisted per screen; controlled from Settings) ----

// useCoverSize persists a grid cell min-width (px) in localStorage per screen.
// On mobile the default shrinks to 100px so covers aren't oversized
// on a narrow viewport. Any previously-saved preference always wins.
export function useCoverSize(key, def = 150, min = 96, max = 240) {
  const [size, setSize] = useState(() => {
    const v = Number(
      typeof localStorage !== "undefined" && localStorage.getItem(key),
    );
    if (v >= min && v <= max) return v;
    // No stored value — use a smaller default on narrow screens.
    return isMobileScreen() ? 100 : def;
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, String(size));
    } catch {
      /* private mode / disabled storage — size just won't persist */
    }
  }, [key, size]);
  return [size, setSize];
}

// ClampMore — the ONLY affordance for a clamped/expandable block now that the
// "show more / show less" text buttons are gone everywhere. A small muted chevron
// that points down when text is hidden and flips up when expanded; the block
// itself is the click target (see .clampable). aria-hidden — the wrapping block
// carries role="button" + aria-expanded for assistive tech.
// onActivate — the keyboard half of a div wearing role="button".
//
// THE BUG IT ENDS: Home's two count tiles carried `role="button"` and
// `tabIndex={0}` and no key handler at all, so a keyboard reader could tab to a
// thing that announced itself as a button, press Enter, press Space, and nothing
// would happen. A control that answers a pointer and ignores a keyboard is worse
// than one that is plainly not a control, because the reader has been told it is.
//
// A helper rather than a third hand-written copy: flow.jsx already had the same
// four lines and Home should not have invented them again. Space is preventDefault
// -ed because on a div it scrolls the page, which is the browser's answer to the
// key rather than the control's.
export function onActivate(fn) {
  if (!fn) return undefined;
  return (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn(e);
    }
  };
}

export function ClampMore({ open }) {
  return (
    <span aria-hidden="true" className="clamp-more" data-open={open ? "1" : "0"}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </span>
  );
}

// ---- ONE OWNER FOR ESCAPE ---------------------------------------------------
//
// THE BUG THIS ENDS: press Escape with a panel open and a row being edited inside
// it, and BOTH close. The draft goes and the panel goes, on one keypress, because
// seventeen keydown listeners were attached to `document` independently and every
// one of them that recognised Escape acted on it. None yielded to the others; none
// stopped propagation. Open Details, press a row's pencil, type, press Escape —
// you lose the words and the screen you were typing them on.
//
// The design pack states the rule in capitals: "ESCAPE CLOSES THE INNERMOST
// SURFACE, ONE LAYER AT A TIME", with an ordered ladder — confirm, then back one
// panel, then close the panel, then the popover, then the dialog.
//
// So there is ONE document listener, in the CAPTURE phase so it runs before any
// listener a component still owns, and it stops the event dead. Everything else
// registers a callback and is only ever called when it is on top.
//
// LAST REGISTERED WINS, and the caveat is worth stating because this codebase has
// already been bitten by it once: React runs a child's effects BEFORE its
// parent's, so two surfaces that mount already-open in the same commit register
// child-first and the PARENT ends up on top. That is the wrong way round. It does
// not bite in practice because nesting here is sequential — a panel is open before
// anything inside it can be opened, and the thing inside registers later — but a
// surface that mounts with a child surface already open would need an explicit
// depth rather than this order.
const escStack = [];
let escBound = false;

function escKey(e) {
  if (e.key !== "Escape") return;
  const top = escStack[escStack.length - 1];
  if (!top) return;
  // Both, and both matter: preventDefault stops the browser's own Escape
  // behaviour (cancelling an IME composition, leaving fullscreen), and
  // stopPropagation is what keeps the layers below from acting on the same press.
  e.preventDefault();
  e.stopPropagation();
  top.run();
}

// useEscape registers one surface's answer to Escape for as long as it is open.
//
// `active` is the surface's own open state, so a component may call this
// unconditionally and register only while it is showing — which is what keeps the
// stack the same shape as what is on screen.
export function useEscape(active, onEscape) {
  const cb = useRef(onEscape);
  cb.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const entry = { run: () => cb.current?.() };
    escStack.push(entry);
    if (!escBound) {
      document.addEventListener("keydown", escKey, true);
      escBound = true;
    }
    return () => {
      const i = escStack.indexOf(entry);
      if (i >= 0) escStack.splice(i, 1);
    };
  }, [active]);
}

// escapeDepth is for the tests: how many surfaces currently claim Escape. A
// number nobody can read from the DOM, and the one thing that goes quietly wrong
// — a surface that closes without unregistering leaks a layer, and the NEXT
// Escape does nothing at all because a dead entry is on top.
export function escapeDepth() {
  return escStack.length;
}

// clampProps builds the shared "click anywhere on the text to toggle" wiring for
// a clamped block: role/tabindex/handlers only when it can actually toggle
// (overflowing, or already open so it can collapse).
// useClamped — the measurement every clamped block was making for itself.
//
// THREE COPIES OF THIS EFFECT, character for character: ExpandableText,
// ExpandableDescription, and — the moment the margin note learned to fold — a
// fourth. Each read `scrollHeight > clientHeight + 2` on its own ref, held its
// own `overflows` state, and built the same `-webkit-box` object. The number 2 is
// a fudge for sub-pixel line heights and it appeared three times, which is three
// places for it to become 2, 2 and 3.
//
// `watch` IS THE CONTENT, and it has to be passed rather than inferred: a
// ResizeObserver watches the BORDER box, which for a clamped element is pinned at
// N lines — so content changing from two words to two paragraphs does not fire
// it. The observer covers the box getting narrower; this covers the text getting
// longer. Callers whose children are nodes pass those nodes and re-measure per
// render, which is correct and cheap on the surfaces that do it; callers with a
// string pass the string and re-measure only when it changes, which is the case
// that runs two hundred times on a board.
function useClamped({ lines, open, watch }) {
  const [overflows, setOverflows] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    // Assigning the same boolean is a no-op React bails out of, so this cannot
    // loop even though the effect runs on every content change.
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 2)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [watch, open, lines])
  // `lines: 0` MEANS DO NOT FOLD, and it is a real answer rather than a missing
  // one: the quiz card's note is the thing being read, not a remark beside
  // something else, so it takes no clamp and offers no control.
  if (!lines) return { ref, canToggle: false, clamp: null }
  return {
    ref,
    // OPEN COUNTS AS TOGGLEABLE. Once expanded the box no longer overflows, so a
    // test on `overflows` alone would take the control away at the moment it is
    // needed to close it again.
    canToggle: overflows || open,
    clamp: open
      ? null
      : { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  }
}

function clampProps(canToggle, toggle) {
  if (!canToggle) return {};
  return {
    role: "button",
    tabIndex: 0,
    onClick: toggle,
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    },
  };
}

// ExpandableDescription clamps body text to `lines` (3 by default) and reveals a
// chevron only when it overflows. Click the text (no button) to expand/collapse.
// Used in the detail hero + person bios so a poster/photo beside it keeps a
// stable height until the reader opens it.
// lines = 4 AND 13px, both the pack's, and both moved rather than argued about:
// a work's description is background, and at 15px over three lines it competed
// with the title two rows above it while showing less of itself. Four lines of 13
// is more words in less height.
//
// THE CHEVRON STAYS, and that is a departure from the pack, stated rather than
// slipped in. The pack folds its description under a mask and makes the prose its
// own control, with no affordance drawn at all. This app decided the opposite
// once, everywhere: ClampMore's own comment calls it "the ONLY affordance for a
// clamped/expandable block now that the show more / show less text buttons are
// gone everywhere", and four other blocks — Home, flow, review, a person's bio —
// draw it. Switching one of the five to a different idiom is the divergence this
// whole pass exists to remove. It is a system decision, not a screen decision.
export function ExpandableDescription({ text, style, lines = 4, className = "" }) {
  const [open, setOpen] = useState(false);
  const { ref, canToggle, clamp } = useClamped({ lines, open, watch: text });
  if (!text) return null;
  return (
    <div
      className={`clampable${canToggle ? " is-clickable" : ""} ${className}`.trim()}
      aria-expanded={canToggle ? open : undefined}
      {...clampProps(canToggle, () => setOpen((o) => !o))}
    >
      <p
        ref={ref}
        style={{ whiteSpace: "pre-wrap", color: "var(--soft)", fontSize: 'var(--type-ui-13)', lineHeight: 1.6, margin: 0, ...style, ...clamp }}
      >
        {text}
      </p>
      {canToggle && (
        <Tooltip label={t(open ? "common.action.show-less.label" : "common.clamp.description.more.tip")} side="bottom" className="flex w-full justify-center">
          <ClampMore open={open} />
        </Tooltip>
      )}
    </div>
  );
}

// usePersistedState mirrors a JSON-serialisable value in localStorage (per
// device) — used for view mode and per-tile sizing, which are viewport prefs
// rather than identity prefs (unlike theme/accent, which live server-side).
// useWorkView — the remembered tiles/table setting for a work's board.
//
// ONE FUNCTION FOR BOTH SCREENS, deliberately. A book's board and a film's board
// are the same board, and their view preference is the same preference under two
// storage keys; written out twice they are two places for the retirement of List
// to be half-done. This is the smallest piece of the "one source" rule that could
// be moved without waiting for the rest of it.
//
// AND IT MIGRATES. Anyone who chose List before it was retired has "list" sitting
// in localStorage, and a value the toggle can no longer produce is a screen with
// no way back to the two that are left.
export function useWorkView(key) {
  const [v, setV] = usePersistedState(key, "tiles");
  return [v === "list" ? "tiles" : v, setV];
}

// SectionTitle — a card's heading, with an optional info dot and a right slot.
//
// IT LIVED IN Settings.jsx and eight of its cards used it. The ninth moved to the
// Metadata screen, and a component two screens import is a shared component —
// importing it from Settings would have pulled that whole route's chunk into
// this one to draw an <h2>.
// SectionTitle — a settings card's heading. `info` is the paragraph that used to
// sit under it: every card on this screen opened with two or three lines of
// explanation, which on a phone meant scrolling past the prose to reach the one
// control each card exists for.
export function SectionTitle({ children, right, info, infoTitle }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <h2 style={{ fontFamily: 'var(--font-ui)', fontStyle: 'var(--font-ui-style)', fontVariantCaps: 'var(--font-ui-caps)', textTransform: 'var(--font-ui-case)', fontVariantNumeric: 'var(--font-ui-figures)', fontSize: 'var(--type-ui-17)', fontWeight: 600 }}>{children}</h2>
        {info && <InfoDot text={info} title={infoTitle || (typeof children === 'string' ? children : t('settings.card.info.title'))} />}
      </div>
      {right}
    </div>
  )
}

// A heading is the one component whose demo can BE the thing: no state, no
// fetch, and the info dot beside it is half of what the entry is for.
if (import.meta.env.DEV) {
  SectionTitle.glossary = {
    demo: (h) => h(SectionTitle, { info: "Where the facts about a work come from." }, "Metadata sources"),
  };
}

export function usePersistedState(key, def) {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s == null ? def : JSON.parse(s);
    } catch {
      return def;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* private mode / disabled storage — just won't persist */
    }
  }, [key, v]);
  return [v, setV];
}

// ExpandableText clamps `text` to `lines` and, when it overflows, becomes a click
// target that expands/collapses in place — a small chevron (ClampMore) is the
// only affordance; there are no "show more / show less" text buttons anywhere.
// The clamp is width-adaptive (CSS line-clamp), so a wider tile shows more text
// before clamping; a ResizeObserver re-checks when a resizable tile changes width.
//
// Expansion is uncontrolled by default (own state). Pass `open` + `onToggle` to
// drive it from the parent — that's how the tiles board runs a one-open-at-a-time
// accordion (expanding one quote collapses the rest).
export function ExpandableText({ text, lines = 5, style, className = "", open: openProp, onToggle }) {
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const toggle = () => (controlled ? onToggle?.() : setOpenState((o) => !o));
  const { ref, canToggle, clamp } = useClamped({ lines, open, watch: text });
  if (!text) return null;
  return (
    <div
      // `card-text` is the region a card's long-press hands to the browser, so a
      // thumb can select words out of a quote (useCardMenu). It belongs on this
      // component rather than on each card that renders one: this IS the quote,
      // everywhere it appears, and a card that forgot the class would be a quote
      // nobody could copy from with no visible sign of it.
      className={`clampable card-text${canToggle ? " is-clickable" : ""} ${className}`.trim()}
      aria-expanded={canToggle ? open : undefined}
      {...clampProps(canToggle, toggle)}
    >
      <p
        ref={ref}
        style={{ whiteSpace: "pre-wrap", margin: 0, ...style, ...clamp }}
      >
        {text}
      </p>
      <ClampToggle canToggle={canToggle} open={open} />
    </div>
  );
}

// initTactile wires a "press where you clicked" feel for any element carrying
// the .tactile class (toggles + primary buttons): on pointerdown it records the
// pointer position into --px/--py on that element and flags data-pressing, so
// CSS can bloom a small depression at exactly that spot. One delegated listener
// — no per-component wiring. Off under prefers-reduced-motion. Call once at boot.
let tactileWired = false;
export function initTactile() {
  if (tactileWired || typeof document === "undefined") return;
  tactileWired = true;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.addEventListener(
    "pointerdown",
    (e) => {
      const el = e.target.closest && e.target.closest(".tactile, .tp-btn");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--px", `${e.clientX - r.left}px`);
      el.style.setProperty("--py", `${e.clientY - r.top}px`);
      el.dataset.pressing = "1";
      const release = () => {
        el.dataset.pressing = "0";
        window.removeEventListener("pointerup", release);
        window.removeEventListener("pointercancel", release);
      };
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", release);
    },
    true,
  );
}

// mulberry32 — a tiny deterministic PRNG. Same seed ⇒ same sequence, so the
// Masonry jitter below is stable across renders and reloads (no per-refresh
// wobble). Seed 0 is degenerate for this generator, so bump it to 1.
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// clampSequence returns `count` clamp-line values in [min, max], drawn uniformly
// from `rng` (pass mulberry32(seed) for a stable board, Math.random for per-load
// variety) with ONE rule: no value repeats three times in a row. When the two
// prior values already match a fresh roll, it re-rolls uniformly among the OTHER
// values — so 3/4/5 stay near-equal in frequency AND the board never shows a run
// of three same-height clamps. The masonry sorts by full text length (not clamped
// height), so these values scatter across the board instead of banding by size.
export function clampSequence(count, rng, min = 3, max = 5) {
  const span = max - min + 1;
  const out = [];
  for (let i = 0; i < count; i++) {
    let v = min + Math.floor(rng() * span);
    if (i >= 2 && out[i - 1] === out[i - 2] && out[i - 1] === v) {
      const k = Math.floor(rng() * (span - 1)); // pick among the other span-1 values
      v = min + (k >= v - min ? k + 1 : k);
    }
    out.push(v);
  }
  return out;
}

// shuffleSeeded orders a list at random and KEEPS THAT ORDER while the list
// changes under it.
//
// The bug it exists for: Home's favourites were shuffled with Fisher–Yates on
// every load, and every in-place edit reloads them — so recolouring one quote,
// or hearting one, redealt the whole wall and the four tiles on screen became
// four different tiles. The reader had acted on a card and the card left.
//
// The fix is not "shuffle less often", which only moves the problem to whichever
// reload is left. It is to draw each item's position from its OWN KEY rather than
// from a walk over the list: same seed + same key ⇒ same rank, forever, whatever
// else is in the list. Fisher–Yates cannot do that — drop one member and the
// permutation is entirely different — while a per-item rank means a removed card
// simply leaves a gap and every other card stays where the reader last saw it.
//
// The seed is the caller's to draw, and WHEN it draws one is the whole feature:
// once per visit to the screen gives a wall that reorders when you arrive and
// holds still while you work.
export function shuffleSeeded(items, seed, keyOf = (x) => x.key) {
  return items
    .map((item, i) => {
      const key = String(keyOf(item) ?? i);
      // FNV-1a over the key, seeded, then one draw — so neighbouring keys
      // ("quote:11", "quote:12") land nowhere near each other.
      let h = (seed >>> 0) ^ 0x811c9dc5;
      for (let j = 0; j < key.length; j++) {
        h ^= key.charCodeAt(j);
        h = Math.imul(h, 0x01000193);
      }
      return { item, key, rank: mulberry32(h)() };
    })
    // The key breaks a rank tie, so two colliding hashes still order the same way
    // on every call rather than however the sort happened to run.
    .sort((a, b) => a.rank - b.rank || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((x) => x.item);
}

// Masonry — packs heterogeneous-height cards into `columns` equal-width columns.
// Two placement orders (`order`):
//   • "height" (default) — an organic collage: sort tallest-first, nudge ~20% of
//     cards 2–3 slots (seeded off `seed`), then deal onto the shortest column.
//   • "source" — keep the children AS GIVEN (newest-first, pinned prefix on top),
//     dealing each in turn onto the shortest column. No height sort, no jitter, so
//     the per-card 3–5 clamp — not a size sort — is what varies the board, and a
//     card's clamp lands exactly where its source position puts it (so a
//     no-3-in-a-row clamp sequence reads that way on the board too).
// `pinnedCount` keeps the first N children glued to the top (skipping the sort).
//
// Rendering matters as much as the algorithm here: every card lives in a FIXED
// DOM slot (a direct child of the container, keyed by index) and is placed with
// absolute left/top. It is NEVER moved between parents, so (a) a card that
// clamps its text or loads an image after mount keeps its ResizeObserver alive
// and the board re-packs on the *real* height, and (b) cards don't lose their
// own state on a re-pack. Column width comes from a CSS calc so heights are
// measured at the true width from the first frame. (The earlier column-<div>
// version orphaned the observer whenever a re-pack moved a card, freezing the
// layout on stale full-text heights — the "one lonely card, rest piled up" bug.)
//
// The column assignment (which card lands in which column, and in what order) is
// computed while the board is still settling — early re-packs let late web-font
// and sticker loads land a balanced board — and is then LATCHED on the rising
// edge of `lockOrder`, i.e. the first expand of a settled board. Once latched it
// is frozen for the life of this card set: expanding OR collapsing a quote only
// re-flows the vertical tops within the fixed columns, so a card grows/shrinks in
// place and nothing ever reshuffles under the reader. A genuine layout change —
// the card set or its identities, the column count crossing a breakpoint, a new
// seed, a change in the pinned count — re-opens free packing (a fresh signature).
// Latching only on the rising edge is what keeps a structural change that lands
// WHILE a quote is open (add / filter / breakpoint) from freezing the columns
// around that one card's expanded height. Heights are rounded for the ordering so
// sub-pixel jitter can't flip a tie and shuffle the board.
// boardRef — the container element, handed back so a caller can MEASURE it.
// useColumnsIn needs the width of the board itself, and the board is this div: a
// caller that wrapped it in one of their own would be measuring a box whose width
// only happens to match. One ref, no wrapper, and Library and the Catalogue ask
// the same question of the same element.
export function Masonry({ boardRef, columns = 2, gap = 24, seed = 1, pinnedCount = 0, lockOrder = false, order = "height", className = "", children }) {
  const items = useMemo(() => Children.toArray(children), [children]);
  const n = items.length;
  const cols = Math.max(1, columns);
  const refs = useRef([]);
  // A cheap rolling hash of the child keys: it folds the card IDENTITIES into the
  // signature, so swapping the set for a same-size one (e.g. a filter that keeps
  // the count) still re-opens packing instead of reusing a stale assignment.
  //
  // EVERY PREFIX IS HASHED, not just the whole list, because a windowed board grows
  // by appending and the whole-list hash cannot tell that from a re-filter. keyHashes[k]
  // is the hash of the first k keys, so "are the cards already on screen still the first
  // of these?" is one integer comparison — see the append branch in the layout effect.
  const keyHashes = useMemo(() => {
    const out = new Array(items.length + 1);
    let hprime = 0;
    out[0] = 0;
    for (let i = 0; i < items.length; i++) {
      const k = String(items[i].key);
      for (let j = 0; j < k.length; j++) hprime = (Math.imul(hprime, 31) + k.charCodeAt(j)) | 0;
      out[i + 1] = hprime;
    }
    return out;
  }, [items]);
  const keyHash = keyHashes[items.length];
  // The frozen placement: order = card indices in placement sequence, colOf[i] =
  // card i's column. assignRef holds it; frozenRef latches once expanded; sigRef
  // is the structural signature whose change re-opens free packing; prevLockRef
  // remembers the last lockOrder so we latch only on its rising edge.
  const assignRef = useRef(null);
  const frozenRef = useRef(false);
  const sigRef = useRef("");
  const prevLockRef = useRef(false);
  // The card count and prefix hash as of the last pass, which is all an append test
  // needs: same geometry, and the old keys still the first of the new ones.
  const prevNRef = useRef(0);
  const prevHashRef = useRef(0);
  const geomRef = useRef("");
  // pos[i] = { col, top } for card i (left derives from col via CSS calc).
  // height = the tallest column, so the relative container reserves the space.
  const [pos, setPos] = useState([]);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    // A real layout change (card set/identity, columns, seed, pin count) — not an
    // expand/collapse — re-opens free packing.
    const sig = `${n}|${cols}|${seed}|${pinnedCount}|${keyHash}`;
    const sigChanged = sigRef.current !== sig;
    // AN APPEND IS NOT A RE-FILTER, and a windowed board only ever grows by one.
    // Revealing the next page changes both `n` and the key hash, which the signature
    // alone reads as "a different set of cards" — so every scroll would re-sort the
    // whole board tallest-first and every card the reader had already looked at would
    // jump to another column mid-scroll. That is the one thing the freeze above exists
    // to prevent, arriving through the other door.
    //
    // So an append is recognised and CARRIED: same geometry, and the cards already
    // placed still the first of the new list. They keep the columns they were given and
    // only the newly revealed tail is packed, onto the columns as they now stand.
    const geom = `${cols}|${seed}|${pinnedCount}`;
    const carry =
      geomRef.current === geom &&
      assignRef.current &&
      prevNRef.current < n &&
      assignRef.current.colOf.length === prevNRef.current &&
      keyHashes[prevNRef.current] === prevHashRef.current
        ? assignRef.current
        : null;
    geomRef.current = geom;
    prevNRef.current = n;
    prevHashRef.current = keyHash;
    if (sigChanged) {
      sigRef.current = sig;
      if (!carry) {
        frozenRef.current = false;
        assignRef.current = null;
      }
    }
    // Latch the assignment on the RISING EDGE of lockOrder (the first expand of a
    // settled board) — never on a pass where a structural change just re-opened
    // packing, or we'd freeze the columns around the currently-expanded (tall)
    // card. If the set changes while a quote stays open, the board keeps free-
    // packing off the live heights and re-latches only when the next expand
    // begins (by then the earlier one has collapsed back to its true height).
    if (lockOrder && !prevLockRef.current && !sigChanged) frozenRef.current = true;
    prevLockRef.current = lockOrder;
    const repack = () => {
      const els = refs.current.slice(0, n);
      const h = els.map((el) => (el ? el.getBoundingClientRect().height : 0));
      const pc = Math.max(0, Math.min(pinnedCount, n));

      let assign = assignRef.current;
      if (!assign || assign.colOf.length !== n || !frozenRef.current) {
        // Round heights for the ORDERING only (tops still flow from exact px) so
        // sub-pixel measurement noise can't reorder a tallest-first sort.
        const hr = h.map((x) => Math.round(x));
        // The placement sequence for the cards from `from` onwards: "source" keeps them
        // as given (newest-first, pinned prefix on top); "height" sorts them tallest-first
        // with a seeded nudge. `from` is 0 for a fresh pack and the old length for an
        // append, so the two cases share one rule rather than growing a second copy.
        const sequence = (from) => {
          if (order === "source") return Array.from({ length: n - from }, (_, k) => k + from);
          // (1) tallest first — only the non-pinned tail (ties → index). A pinned card is
          // only ever in the first page, so an append has no pinned prefix to protect.
          const base = Math.max(from, pc);
          const rest0 = Array.from({ length: n - base }, (_, k) => k + base).sort((a, b) => hr[b] - hr[a] || a - b);
          const rankOf = new Array(n);
          rest0.forEach((i, r) => (rankOf[i] = r));
          // (2) seeded ±2–3 nudge on ~20% of cards: shift the mover's sort key, then
          // re-sort (ties → original rank). Draw a fixed 3 rolls per card so the
          // sequence stays deterministic whether or not a card actually moves.
          const rng = mulberry32(seed);
          const key = new Array(n);
          for (let r = 0; r < rest0.length; r++) {
            const move = rng() < 0.2;
            const step = rng() < 0.5 ? 2 : 3;
            const up = rng() < 0.5;
            key[rest0[r]] = r + (move ? (up ? -step : step) : 0);
          }
          const rest = rest0.slice().sort((a, b) => key[a] - key[b] || rankOf[a] - rankOf[b]);
          // Pinned prefix stays on top in its given order, then the height-packed tail.
          const out = [];
          for (let i = from; i < base; i++) out.push(i);
          for (const i of rest) out.push(i);
          return out;
        };
        // An append replays the carried sequence first — the column heights have to
        // accumulate in the order they originally did for the new tail to land on the
        // right columns — and then packs only what is new.
        const placeOrder = carry ? [...carry.order, ...sequence(carry.colOf.length)] : sequence(0);
        // (3) greedy by rows: each card, in that order, onto the shortest column — this
        // FIXES each card's column; every later re-flow only moves tops. A carried card
        // keeps the column it already has and only contributes its height.
        const colOf = new Array(n);
        const colH0 = Array(cols).fill(0);
        for (const i of placeOrder) {
          let col;
          if (carry && i < carry.colOf.length) {
            col = carry.colOf[i];
          } else {
            col = 0;
            for (let c = 1; c < cols; c++) if (colH0[c] < colH0[col]) col = c;
          }
          colOf[i] = col;
          colH0[col] += hr[i] + gap;
        }
        assign = { order: placeOrder, colOf };
        assignRef.current = assign;
      }
      // Flow tops from the live (exact) heights, following the frozen columns.
      const colH = Array(cols).fill(0);
      const next = new Array(n);
      for (const i of assign.order) {
        const col = assign.colOf[i];
        next[i] = { col, top: colH[col] };
        colH[col] += h[i] + gap;
      }
      setPos((prev) =>
        prev.length === n && prev.every((p, i) => p.col === next[i].col && p.top === next[i].top) ? prev : next,
      );
      setHeight(Math.max(0, ...colH.map((x) => x - gap)));
    };
    repack();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(repack);
    refs.current.slice(0, n).forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [n, cols, gap, seed, pinnedCount, lockOrder, keyHash, order]);

  // Column width and each column's left edge as CSS calc, so they track the
  // container width with no JS: colW = (100% − gutters) / cols; left = col share.
  const colW = `calc((100% - ${(cols - 1) * gap}px) / ${cols})`;
  const leftOf = (col) => (cols <= 1 ? "0px" : `calc(${col} * (100% + ${gap}px) / ${cols})`);
  return (
    <div ref={boardRef} className={className} style={{ position: "relative", height: height || undefined }}>
      {items.map((child, i) => {
        const p = pos[i];
        return (
          <div
            key={i}
            ref={(el) => (refs.current[i] = el)}
            style={{
              position: "absolute",
              width: cols <= 1 ? "100%" : colW,
              left: p ? leftOf(p.col) : 0,
              top: p ? p.top : 0,
              // Hidden only until the first (pre-paint) measurement positions it.
              visibility: p ? "visible" : "hidden",
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}

// Toggle — the one segmented switch used everywhere (2- or 3-option). The active
// "thumb" slides between options with a rubbery spring, and a press depression
// blooms where you click (initTactile). The thumb is measured off the live DOM,
// so it tracks any label widths (incl. icon labels). Optional MonoLabel above.
// nearestRow picks the option whose centre is closest to a dragged thumb's
// centre. Shared by Toggle (horizontal) and Select (vertical) — both measure
// their options once at pointerdown and then work purely geometrically, so a
// drag never depends on which element an event happened to land on.
function nearestRow(opts, center) {
  let best = 0,
    bestD = Infinity;
  for (let i = 0; i < opts.length; i++) {
    const d = Math.abs(center - opts[i].center);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function Toggle({
  value,
  onChange,
  options,
  label,
  ariaLabel,
  className = "",
  disabled = false,
}) {
  const ref = useRef(null);
  const thumbRef = useRef(null);
  const drag = useRef(null); // live drag state (never triggers a re-render)
  const suppressClick = useRef(false); // eat the click that trails a real drag
  // The hint slot's token for whichever option is currently hovered — one ref for
  // the whole control, since only one option can be under the pointer at a time.
  const hint = useRef(0);
  // A toggle inside a sheet or a card can be unmounted with the pointer still on
  // it, which would leave its label with nothing to close it.
  useEffect(() => () => hideHint(hint.current), []);
  const rawIdx = options.findIndex(([k]) => k === value);
  // Place the thumb under the active option; this is also the snap target the
  // thumb animates to after a drag (with the material's ease, since dragging
  // clears first).
  useLayoutEffect(() => {
    const el = ref.current;
    const thumb = thumbRef.current;
    if (!el || !thumb) return;
    const place = () => {
      // No match (e.g. the nav toggle while on a utility tab) → hide the thumb.
      if (rawIdx < 0) {
        thumb.style.opacity = "0";
        return;
      }
      const a = el.querySelectorAll(".tp-toggle-opt")[rawIdx];
      if (!a) return;
      thumb.style.opacity = "1";
      thumb.style.width = `${a.offsetWidth}px`;
      thumb.style.transform = `translateX(${a.offsetLeft}px)`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rawIdx, value, options.length]);

  // A slider toggle can be dragged: the thumb tracks the pointer 1:1 and commits
  // to the nearest option on release; the press bloom follows the finger (its
  // intensity is the material's --press-a — full for rubber, gentle for leather,
  // zero for wood/metal). A plain tap (no movement) falls through to the option
  // button's onClick, so clicking still works.
  const onPointerMove = (e) => {
    const d = drag.current;
    const el = ref.current;
    const thumb = thumbRef.current;
    if (!d || !el || !thumb) return;
    if (!d.moved) {
      if (Math.abs(e.clientX - d.startX) < 5) return; // below threshold → still a tap
      d.moved = true;
      el.dataset.dragging = "1";
    }
    const px = e.clientX - d.left;
    const last = d.opts[d.opts.length - 1];
    const min = d.opts[0].left;
    const max = last.left + last.width - d.thumbW;
    // Keep the grabbed point of the thumb under the cursor (d.grab is the offset
    // from the thumb's left edge to where the pointer landed), instead of always
    // centring the thumb on the cursor.
    const left = Math.max(min, Math.min(max, px - d.grab));
    thumb.style.transform = `translateX(${left}px)`;
    d.hover = nearestRow(d.opts, left + d.thumbW / 2);
    el.style.setProperty("--px", `${px}px`);
    el.style.setProperty("--py", `${e.clientY - d.top}px`);
    el.dataset.pressing = "1";
  };
  const onPointerUp = () => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    if (!el) return;
    el.dataset.pressing = "0";
    if (d && d.moved) {
      el.dataset.dragging = "0";
      suppressClick.current = true;
      // safety: never leave the flag stuck if no trailing click fires
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      const k = options[d.hover] && options[d.hover][0];
      if (k != null && k !== value) onChange(k);
      else {
        const a = el.querySelectorAll(".tp-toggle-opt")[rawIdx];
        const thumb = thumbRef.current;
        if (a && thumb) thumb.style.transform = `translateX(${a.offsetLeft}px)`; // snap back
      }
    }
  };
  const onPointerDown = (e) => {
    if (disabled) return;
    const el = ref.current;
    const thumb = thumbRef.current;
    if (!el || !thumb || rawIdx < 0 || (e.button != null && e.button !== 0))
      return;
    const nodes = [...el.querySelectorAll(".tp-toggle-opt")];
    if (!nodes[rawIdx]) return;
    const rect = el.getBoundingClientRect();
    const thumbW = nodes[rawIdx].offsetWidth;
    // Where inside the thumb did the pointer land? Clamp to the thumb so a grab
    // that starts on another option still tracks sensibly (edge follows cursor).
    const grab = Math.max(
      0,
      Math.min(thumbW, e.clientX - rect.left - nodes[rawIdx].offsetLeft),
    );
    drag.current = {
      startX: e.clientX,
      moved: false,
      hover: rawIdx,
      grab,
      left: rect.left,
      top: rect.top,
      thumbW,
      opts: nodes.map((o) => ({
        left: o.offsetLeft,
        width: o.offsetWidth,
        center: o.offsetLeft + o.offsetWidth / 2,
      })),
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };
  const control = (
    <div
      ref={ref}
      role="tablist"
      aria-label={ariaLabel || label}
      className={`tp-toggle tactile${disabled ? " is-disabled" : ""} ${className}`}
      aria-disabled={disabled || undefined}
      onPointerDown={onPointerDown}
    >
      <span ref={thumbRef} className="tp-toggle-thumb" aria-hidden="true" />
      {options.map(([k, lbl, tip]) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={value === k}
          aria-pressed={value === k}
          className={"tp-toggle-opt" + (value === k ? " is-on" : "")}
          disabled={disabled}
          // A third element in an option tuple is its hover label. Driven from
          // here rather than by wrapping each button in a <Tooltip>: the thumb is
          // positioned from each option's offsetLeft, and .tp-tip-wrap is
          // position:relative, so a wrapper would reset every offset to ~0 and
          // park the thumb under the first tab forever. Since 1.4.1 the bubble is
          // script-driven, so it can be asked for directly, with no DOM at all.
          onPointerEnter={(e) => {
            if (!tip || e.pointerType === "touch") return;
            hideHint(hint.current);
            hint.current = showHint(tip, e.currentTarget.getBoundingClientRect(), "bottom");
          }}
          onPointerLeave={() => { hideHint(hint.current); hint.current = 0 }}
          onClick={() => {
            // The label describes where you were about to go; once you are there
            // it is stale, and it would otherwise hang over the new screen.
            hideHint(hint.current);
            hint.current = 0;
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            onChange(k);
          }}
        >
          {lbl}
        </button>
      ))}
    </div>
  );
  if (!label) return control;
  return (
    <div>
      <MonoLabel className="mb-2 block">{label}</MonoLabel>
      {control}
    </div>
  );
}

// TokenInput — a tags/genres field: existing values render as removable pills,
// and typing filters `suggestions` into a dropdown (Enter/comma or click adds;
// Backspace on an empty field removes the last). `value`/`onChange` are a string
// array, so callers no longer juggle comma-joined strings.
export function TokenInput({
  value = [],
  onChange,
  suggestions = [],
  placeholder,
  ariaLabel,
  transform,
  nameCase = false,
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const norm = (tok) => (transform ? transform(tok) : tok);
  // The draft is stored exactly as typed — `nameCase` is a keyboard hint on the
  // entry box below, nothing more. `transform` (genres) still normalises on
  // COMMIT, which is a closed vocabulary and never fights the person typing.
  const onType = setText;
  const q = text.trim().toLowerCase();
  const matches = suggestions
    .filter((s) => !value.includes(s) && (!q || s.toLowerCase().includes(q)))
    .slice(0, 8);
  // Adding always splits on commas — one "add" can enter several tokens — and
  // each is run through the optional transform (e.g. Title-Case for genres).
  const add = (tok) => {
    const pieces = splitCommas(String(tok || ""))
      .map(norm)
      .filter(Boolean);
    if (pieces.length) {
      const next = [...value];
      for (const p of pieces) if (!next.includes(p)) next.push(p);
      onChange(next);
    }
    setText("");
    setHi(0);
    setOpen(false);
  };
  // Normalize whatever arrives from the parent (a metadata candidate can hand in
  // one comma-joined "Fiction, fantasy, general" string, or mixed casing): split
  // on commas, transform, dedupe. Idempotent, so this settles after one pass.
  useEffect(() => {
    const cleaned = [];
    for (const v of value)
      for (const p of splitCommas(v).map(norm))
        if (p && !cleaned.includes(p)) cleaned.push(p);
    const same =
      cleaned.length === value.length &&
      cleaned.every((tok, i) => tok === value[i]);
    if (!same) onChange(cleaned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const removeAt = (i) => onChange(value.filter((_, j) => j !== i));
  const onKey = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(open && matches[hi] ? matches[hi] : text);
    } else if (e.key === "Backspace" && !text && value.length) {
      removeAt(value.length - 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHi((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };
  // The menu only exists when there is something to suggest, and the hook has
  // to agree with that or it measures an element that was never rendered.
  const menuOpen = open && matches.length > 0;
  const { popRef, style } = useAnchoredPosition(menuOpen, boxRef, { matchWidth: true, minHeight: 120 });
  useDismiss(menuOpen, () => setOpen(false), [boxRef, popRef], { event: "pointerdown" });
  return (
    <div className="token-input" ref={boxRef}>
      <div
        className="tp-input token-field"
        onClick={() => inputRef.current && inputRef.current.focus()}
      >
        {value.map((tok, i) => (
          <span key={tok} className="token-pill">
            {tok}
            <Tooltip label={t("common.action.remove.aria", { name: tok })}>
              <button
                type="button"
                className="token-x"
                onClick={() => removeAt(i)}
                aria-label={t("common.action.remove.aria", { name: tok })}
              >
                ×
              </button>
            </Tooltip>
          </span>
        ))}
        <input
          ref={inputRef}
          className="token-entry"
          // A name token — a character, an actor — gets the per-word offer, and
          // anything else keeps the browser default. See "name casing".
          autoCapitalize={nameCase ? "words" : undefined}
          value={text}
          placeholder={value.length ? "" : placeholder || t("common.field.token.placeholder")}
          aria-label={ariaLabel}
          autoComplete="off"
          onChange={(e) => {
            onType(e.target.value);
            setOpen(true);
            setHi(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          onBlur={(e) => {
            // Commit un-entered text when focus leaves the control entirely —
            // otherwise a tag typed without Enter silently vanishes on Save.
            // Focus moving inside the control (a suggestion click) defers to
            // the option's own add().
            //
            // BOTH refs, and this is the trap the portal sets. The menu is no
            // longer a descendant of boxRef, so asking only boxRef makes every
            // suggestion click look like "focus left the control" — and this
            // handler then commits the TYPED text before the option's add() can
            // run. Picking "fantasy" after typing "fant" would enter `fant`.
            if (boxRef.current && boxRef.current.contains(e.relatedTarget)) return;
            if (popRef.current && popRef.current.contains(e.relatedTarget)) return;
            if (text.trim()) add(text);
            else setOpen(false);
          }}
        />
      </div>
      {menuOpen && createPortal(
        <ul ref={popRef} className="token-menu" style={style}>
          {matches.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                className={"token-opt" + (i === hi ? " hi" : "")}
                onMouseEnter={() => setHi(i)}
                onClick={() => add(s)}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}

// EditReveal animates its height when the content swaps (view ↔ edit form), so
// opening/closing an inline editor glides the content below instead of snapping
// it. Overflow is only clamped during the transition, so a sticker that spills
// into the gutter isn't clipped at rest.
export function EditReveal({ open, children }) {
  const ref = useRef(null);
  const prev = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = el.scrollHeight;
    if (prev.current != null && prev.current !== target) {
      el.style.overflow = "hidden";
      el.style.height = prev.current + "px";
      void el.offsetHeight; // force a reflow so the next height change transitions
      el.style.transition = "height .26s cubic-bezier(.2,.68,.28,1)";
      el.style.height = target + "px";
      const done = (e) => {
        if (e.propertyName !== "height") return;
        el.style.height = "auto";
        el.style.transition = "";
        el.style.overflow = "";
        el.removeEventListener("transitionend", done);
      };
      el.addEventListener("transitionend", done);
    } else {
      el.style.height = "auto";
      el.style.overflow = "";
    }
    prev.current = target;
  }, [open]);
  return <div ref={ref}>{children}</div>;
}

// Select — the on-brand dropdown that replaces native <select> (which renders
// the OS list). The trigger is a tactile field; the panel dips open below it and
// carries the SAME sliding accent thumb as Toggle (just vertical) so the
// highlight animates identically. Hover or arrow keys move the highlight; click
// or Enter commits. Closes on outside-click / Escape.
export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder,
  className = "",
  width,
  // Same caller and same reason as ColorSwatches' `disabled`: the selection bar
  // holds its shape with nothing picked, and a live "move to…" over an empty
  // selection is a control that can only fail.
  disabled = false,
  // TYPEABLE. The panel grows a filter box and the list narrows as you type.
  //
  // A PROP ON THIS RATHER THAN A SECOND COMPONENT. A combobox is a dropdown that
  // can be typed into, and everything else about it is this one — the anchored
  // panel, the drag-to-pick thumb, the arrow keys, the dismiss rules, the ARIA.
  // Writing it again beside this would be two dropdowns to keep in step, which is
  // the shape this repository keeps having to pull back apart. Off by default, so
  // the two dozen Selects that are three options long stay exactly as they were.
  filter = false,
  filterPlaceholder,
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0); // highlighted row (hover / keyboard)
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const panelRef = useRef(null);
  const thumbRef = useRef(null);
  const idx = options.findIndex(([v]) => v === value);
  const label = idx >= 0 ? options[idx][1] : placeholder || t("common.field.select.placeholder");
  // `shown` is what the PANEL is: the options after filtering. Everything below
  // indexes into it — the highlight, the arrow keys, the drag maths, the rows —
  // while the trigger's label above still comes from the full list, because the
  // value that is set does not stop being set by being typed past.
  //
  // Matched case-insensitively, and on the WORDS the reader can see — not on the
  // value tokens behind them. A third element in an option carries that text for
  // the case a label is a node rather than a string: the face picker draws every
  // option in its own typeface, so its labels are elements and String() on one
  // would match the whole list against "[object Object]".
  const q = filter ? query.trim().toLowerCase() : "";
  const searchText = ([, lbl, text]) => String(text ?? (typeof lbl === "string" ? lbl : "")).toLowerCase();
  const shown = q ? options.filter((o) => searchText(o).includes(q)) : options;
  // The textured thumb is grab-and-slide here exactly as it is in Toggle, only
  // down the panel instead of along the row. Live drag state sits in a ref so a
  // move never re-renders, and the listener identities ride on the record so a
  // mid-drag re-render (setHi) can't orphan the teardown.
  const drag = useRef(null);
  const suppressClick = useRef(false); // eat the click that trails a real drag

  const cancelDrag = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    window.removeEventListener("pointermove", d.move);
    window.removeEventListener("pointerup", d.up);
    window.removeEventListener("pointercancel", d.up);
    if (panelRef.current) panelRef.current.dataset.dragging = "0";
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    const panel = panelRef.current;
    const thumb = thumbRef.current;
    if (!d || !panel || !thumb) return;
    if (!d.moved) {
      if (Math.abs(e.clientY - d.startY) < 5) return; // still a tap, not a drag
      d.moved = true;
      panel.dataset.dragging = "1";
    }
    // Content space, not viewport space: the thumb is absolutely positioned
    // inside a panel that can scroll, so it must be compared against offsetTop
    // in the same frame of reference.
    const rect = panel.getBoundingClientRect();
    const py = e.clientY - rect.top + panel.scrollTop;
    const last = d.opts[d.opts.length - 1];
    const min = d.opts[0].top;
    const max = last.top + last.height - d.thumbH;
    // Keep the grabbed point of the thumb under the pointer rather than
    // centring it there — the same rule Toggle uses.
    const top = Math.max(min, Math.min(max, py - d.grab));
    thumb.style.transform = `translateY(${top}px)`;
    const next = nearestRow(d.opts, top + d.thumbH / 2);
    if (next !== d.hover) {
      d.hover = next;
      setHi(next);
    }
    // A list taller than its panel scrolls itself when the thumb reaches an edge.
    if (panel.scrollHeight > panel.clientHeight) {
      const inView = e.clientY - rect.top;
      if (inView < 24) panel.scrollTop -= 8;
      else if (inView > rect.height - 24) panel.scrollTop += 8;
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    cancelDrag();
    if (!d || !d.moved) return; // a plain tap falls through to the option's onClick
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false; // never leave it stuck
    }, 0);
    const opt = shown[d.hover];
    if (opt) {
      onChange(opt[0]);
      setOpen(false);
    }
  };

  const onPanelPointerDown = (e) => {
    const panel = panelRef.current;
    const thumb = thumbRef.current;
    if (!panel || !thumb) return;
    if (e.button != null && e.button !== 0) return;
    // A scrolling list keeps the native touch gesture: touch-action can't serve
    // both the thumb and the scroller. Hover and the arrow keys still work there.
    if (e.pointerType !== "mouse" && panel.dataset.scroll === "1") return;
    const nodes = [...panel.querySelectorAll(".tp-select-opt")];
    const from = nodes[hi] ? hi : 0;
    if (!nodes[from]) return;
    const rect = panel.getBoundingClientRect();
    const thumbH = nodes[from].offsetHeight;
    const py = e.clientY - rect.top + panel.scrollTop;
    drag.current = {
      startY: e.clientY,
      moved: false,
      hover: from,
      grab: Math.max(0, Math.min(thumbH, py - nodes[from].offsetTop)),
      thumbH,
      opts: nodes.map((o) => ({
        top: o.offsetTop,
        height: o.offsetHeight,
        center: o.offsetTop + o.offsetHeight / 2,
      })),
      move: onPointerMove,
      up: onPointerUp,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  // Escape and outside-click unmount the panel; a drag in flight must not be
  // left holding window listeners.
  useEffect(() => {
    if (!open) cancelDrag();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => cancelDrag, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) setHi(idx >= 0 ? idx : 0);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const thumb = thumbRef.current;
    if (!panel || !thumb) return;
    // Whether this list scrolls decides touch-action (see onPanelPointerDown).
    panel.dataset.scroll = panel.scrollHeight > panel.clientHeight ? "1" : "0";
    if (drag.current && drag.current.moved) return; // the pointer owns the thumb
    const el = panel.querySelectorAll(".tp-select-opt")[hi];
    if (!el) return;
    thumb.style.height = `${el.offsetHeight}px`;
    thumb.style.transform = `translateY(${el.offsetTop}px)`;
    thumb.style.opacity = "1";
  }, [open, hi, shown.length]);
  // matchWidth 'min': the panel is at least as wide as the trigger and may grow
  // past it for a long option — which is what `min-width: 100%` meant before,
  // and which stops meaning anything once the panel is portalled and 100% is a
  // percentage of <body>.
  //
  // A closed panel keeps no query. Re-opening it to find the last search still in
  // the box, and the list still narrowed to it, is the panel remembering something
  // the reader has no reason to expect it to.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);
  // And the highlight follows the filter rather than pointing past the end of it:
  // type until one option is left and Enter must take that one.
  useEffect(() => {
    setHi((h) => (h < shown.length ? h : 0));
  }, [shown.length]);
  const { popRef, style } = useAnchoredPosition(open, ref, { matchWidth: "min", minHeight: 140 });
  useDismiss(open, () => setOpen(false), [ref, popRef]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      // Escape is not handled here — see useEscape, registered below. The arrows
      // and Enter stay: they are this listbox's own navigation, nobody else
      // competes for them, and they do not close anything.
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHi((h) => Math.min(shown.length - 1, h + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHi((h) => Math.max(0, h - 1));
      } else if (e.key === "Enter" && shown[hi]) {
        e.preventDefault();
        onChange(shown[hi][0]);
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, hi, shown, onChange]);
  // ONE OWNER FOR ESCAPE — see useEscape. An open Select inside a panel used to
  // close both on one press.
  useEscape(open, () => setOpen(false));
  return (
    <div
      className={`tp-select ${className}`}
      ref={ref}
      style={width ? { width } : undefined}
    >
      <button
        type="button"
        className="tp-select-trigger tactile"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          // A drag released over the trigger must not re-open the panel.
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          setOpen((o) => !o);
        }}
      >
        <span className={idx >= 0 ? "" : "tp-select-ph"}>{label}</span>
        <svg
          className="tp-select-chev"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {open && createPortal(
        <div
          className="tp-select-panel"
          role="listbox"
          // One element, two refs: panelRef drives the drag-to-pick maths and
          // the thumb, popRef drives placement. The drag survives the portal
          // untouched because it works in the panel's OWN coordinate space
          // (clientY - rect.top + scrollTop), which does not care where on the
          // page the panel ended up.
          ref={(el) => {
            panelRef.current = el;
            popRef.current = el;
          }}
          onPointerDown={onPanelPointerDown}
          style={style}
        >
          <span className="tp-select-thumb" ref={thumbRef} aria-hidden="true" />
          {filter && (
            /* INSIDE the panel rather than replacing the trigger, which is the
               other way to build a combobox and the wrong one here: the trigger
               has to keep SAYING what is set, and an input pre-filled with the
               current value invites you to edit a name that is not editable. So
               the panel opens with an empty box that narrows the list, and the
               answer to "what is set now" stays on screen behind it.

               autoFocus, because the panel was opened in order to pick something.
               onPointerDown is stopped so the panel's drag-to-pick handler does
               not read a click in the box as a grab of the thumb. */
            <input
              className="tp-select-filter"
              type="text"
              autoFocus
              value={query}
              placeholder={filterPlaceholder || t("common.field.filter.placeholder")}
              aria-label={filterPlaceholder || t("common.field.filter.placeholder")}
              onChange={(e) => setQuery(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
            />
          )}
          {filter && shown.length === 0 && (
            <span className="tp-select-empty">{t("common.field.filter.none")}</span>
          )}
          {shown.map(([v, lbl], i) => (
            <button
              key={v}
              type="button"
              role="option"
              aria-selected={v === value}
              className={"tp-select-opt tactile" + (i === hi ? " is-hi" : "")}
              onMouseEnter={() => setHi(i)}
              onClick={() => {
                // A real drag already committed on pointerup; swallow the
                // trailing click so it can't commit a second time.
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                onChange(v);
                setOpen(false);
              }}
            >
              {lbl}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

// useConfirm — the browser's confirm(), in this app's dialog and this app's
// language, with the same shape at the call site.
//
// WHY A PROMISE AND NOT A PAIR OF PROPS. Thirteen destructive actions were still
// written `if (!confirm(ask)) return` — one line, before the work, reading in the
// order it happens. Rewriting each of them as a pending-item state plus a dialog
// plus a second handler is thirteen chances to wire the wrong item into the wrong
// dialog. This keeps the line: `if (!(await ask(question))) return`.
//
// AND jsdom HAS NO confirm(), which is the half nobody sees: it warns and returns
// undefined, so every one of those thirteen paths returned early in every test
// that reached it. They were not lightly covered, they were uncoverable — the
// delete under the question has never run in the suite. This one is ordinary DOM.
//
// Returns { ask, confirmDialog } — the shape usePractice already uses in this
// codebase. Put `confirmDialog` anywhere in the component's tree.
export function useConfirm() {
  const [state, setState] = useState(null); // {title, body, confirmLabel, resolve}
  const ask = useCallback(
    (title, opts) => new Promise((resolve) => setState({ title, ...opts, resolve })),
    [],
  );
  // ANSWERING TWICE MUST NOT REJECT: Escape and the backdrop can both fire on the
  // way out, and a resolved promise ignores the second — but the state has to go
  // in one step either way or the dialog flashes back.
  const answer = (yes) => {
    setState((cur) => {
      if (cur) cur.resolve(yes);
      return null;
    });
  };
  const dialog = (
    <ConfirmDialog
      open={!!state}
      title={state?.title || ""}
      body={state?.body}
      confirmLabel={state?.confirmLabel}
      onConfirm={() => answer(true)}
      onCancel={() => answer(false)}
    />
  );
  return { ask, confirmDialog: dialog };
}

// NameScroll — a name that scrolls under the fade instead of being cut short.
//
// THE RULE IT EXISTS TO KEEP: a shortened name and a short name look alike, so an
// ellipsis on a name destroys the one thing the row was drawn to show.
// "Alexander Hamilto…" and "Alex" are indistinguishable to a reader, and neither
// of them is a name they can act on.
//
// WHY A COMPONENT AND NOT A CLASS. The fade is MEASURED — useEdgeScroll writes
// data-scroll-x only when there is something behind the edge — and a fade with
// nothing behind it is a lie that makes every other fade in the app a maybe. A
// bare class cannot measure, so it would paint a fade on every name whether it
// overflowed or not. Thirty-one sites needed this; thirty-one copies of a ref and
// a hook is thirty-one chances to forget the measurement.
//
// A DRAG INSIDE A BUTTON IS SAFE. useEdgeScroll takes its pointer capture only
// after 3px of movement, so a press-and-release still reaches whatever is
// underneath and only a real drag scrolls — the fix that stopped every scroller in
// the app from eating its own clicks. That is what lets this wrap a name that is
// also a link.
//
// `as` takes an element name for the few places a span is wrong — a table cell,
// a heading. Everything else gets the default.
export function NameScroll({ children, as: As = "span", className = "", ...rest }) {
  const ref = useRef(null);
  useEdgeScroll(ref, { axis: "x" });
  return (
    <As ref={ref} className={`name-scroll ${className}`.trim()} {...rest}>
      {children}
    </As>
  );
}

if (import.meta.env.DEV) {
  NameScroll.glossary = {
    demo: (
      <div style={{ width: 180 }}>
        <NameScroll>Bibhutibhushan Bandyopadhyay</NameScroll>
      </div>
    ),
  };
}

// ConfirmDialog — an on-brand confirmation modal (replaces native confirm()):
// title, optional body, and Cancel / confirm tactile buttons. Escape or a
// backdrop click cancels. Render it conditionally with `open`.
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  // Greyed until the dialog's own condition is met — a typed confirmation phrase,
  // for the one action that asks for one. The button says so first rather than
  // refusing after the click, which is the rule every Save in this app follows.
  confirmDisabled = false,
  onConfirm,
  onCancel,
}) {
  // ONE OWNER FOR ESCAPE — see useEscape. This dialog used to answer the key
  // itself, which meant a confirm inside a panel closed both.
  useEscape(open, () => onCancel && onCancel());
  // Before the early return, because hooks cannot be conditional — which is
  // also why this takes `open` rather than `true` the way the always-mounted
  // dialogs do.
  useBodyScrollLock(open);
  if (!open) return null;
  // PORTALLED TO <body>, for the reason FormModal states twenty lines down and
  // this one learned the hard way: a `.hand-card` is `isolation: isolate`, so a
  // dialog rendered inside one is trapped in that card's stacking context and
  // every later sibling card paints over it — z-50 and all. Found by looking at a
  // render of the tag delete, where the question appeared UNDER the tags. It only
  // went unnoticed this long because every earlier caller happened to render it
  // at the top of a page; useConfirm exists so that no longer has to be true.
  return createPortal(
    <div
      // NOT `SCRIM`: a question box is centred VERTICALLY and does not scroll —
      // it is two sentences and two buttons, and a sheet's `items-start` would
      // pin it to the top of an otherwise empty screen. The dismiss is the same
      // dismiss.
      className="tp-scrim fixed inset-0 z-50 flex items-center justify-center px-4 py-10"
      onMouseDown={backdropClose(onCancel)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="hand-card hc-r2 w-full max-w-md px-6 py-6"
      >
        <h2 className="display-title mb-2" style={{ fontSize: 'var(--type-ui-19)' }}>
          {title}
        </h2>
        {body && (
          <div
            className="mb-5"
            style={{ color: "var(--soft)", fontSize: 'var(--type-ui-15)', lineHeight: 1.55 }}
          >
            {body}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onCancel}>{t("common.action.cancel.label")}</GhostButton>
          <StickerButton onClick={onConfirm} disabled={confirmDisabled}>{confirmLabel || t("common.action.confirm.label")}</StickerButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// FormModal — the shared shell every edit form now opens in (pop-up edits are
// the house style). Desktop: a centred, scrollable dialog over a dimmed page,
// dismissed by Escape, the × , or a backdrop click. Mobile: a full-screen
// MobileSheet, so the on-screen keyboard has room. The form itself supplies its
// Save/Cancel row (Cancel should call onClose); this only frames it. Body scroll
// is locked while open so the page behind can't scroll under the overlay.
// FormHostContext — how a form inside a dialog and the dialog's own header find
// each other.
//
// A dialog's two answers are yes and no and they belong together, so the ✓ sits
// beside the ✕ in the header rather than at the foot of a form that scrolls. That
// puts the commit control OUTSIDE the <form> it commits, which needs three things
// arranged between them, and this context is all three:
//
//   formId     the header's button is a real type="submit" bound back by the HTML
//              `form=` attribute. That keeps onSubmit as the single entry point,
//              and — because a form-owned submit button is the form's DEFAULT
//              button — it is also the entire reason Enter in a field still saves.
//              A form with several text inputs and no default button does nothing
//              at all on Enter, silently.
//   setBlocked the form tells the header WHY it cannot be saved yet, so the ✓ can
//              grey itself and say so. A header button cannot validate a form it
//              does not contain.
//   presence   a form that finds a host drops its own footer buttons; one that
//              does not keeps them, because these forms are also used inline —
//              the search modal's editor, the capture surface — where there is no
//              header to put anything in.
//
// It is a context rather than a prop so that adding the pattern cost no call site
// anything: every FormModal in the app got the header ✓ without being touched.
//
// AND THAT IS EXACTLY WHY THE ✓ HAS TO BE EARNED. Not every FormModal holds a
// form: WorkDetails is a panel that saves each field on its own, and the staged-
// quote editor commits through its own buttons. A header ✓ on either would be a
// control that looks like it saves and does nothing — worse than no control. So
// the reason is `null` until a form registers, and the button is absent until
// then rather than present and inert.
// UnsavedFieldsContext (1.14.2) — one save for a panel whose rows each save
// themselves.
//
// The Details panel is deliberately a row of self-saving fields: the modal it
// replaced made you re-save a whole record to change one line. That is still
// right for changing one line, and it is tiring for changing six — you open,
// type, press ✓, open the next. So the per-row controls stay exactly as they
// are, and a master ✓ appears in the sheet's header when anything is open with
// an unsaved edit in it.
//
// IT COLLECTS PATCHES, NOT SAVES, and that is the part that matters. Every row
// PUTs the FULL record with its one field changed, so N rows saving themselves
// is N full-state writes racing each other: run them together and the last reply
// wins; run them in order and each one still reads the record as it was before
// the previous reply landed. Either way five of your six edits vanish, with six
// green toasts saying they were saved. One merged patch in one PUT is the only
// version of this that is correct.
export const UnsavedFieldsContext = createContext(null);

// useUnsavedFields is the host side: the registry, and the merged read of it.
//
// A row registers when it becomes dirty and unregisters when it stops, so the
// state that drives the header button changes once per row rather than once per
// keystroke. What the row hands over is a GETTER rather than its draft, which is
// what lets the typing itself stay out of the registry entirely.
export function useUnsavedFields() {
  const rows = useRef(new Map());
  const [ids, setIds] = useState([]);
  const register = useCallback((id, entry) => {
    if (entry) rows.current.set(id, entry);
    else rows.current.delete(id);
    setIds([...rows.current.keys()]);
  }, []);
  const host = useMemo(() => ({ register }), [register]);
  // Read at save time, never held in state: the drafts are live.
  const collect = useCallback(() => [...rows.current.values()], []);
  const closeAll = useCallback(() => {
    for (const e of [...rows.current.values()]) e.close?.();
  }, []);
  return { host, count: ids.length, collect, closeAll };
}

export const FormHostContext = createContext(null);

// usePanelHead — a body hands its panel the header the pack draws: the cover with
// its medium glyph, the crumb under the name, and the record's own name.
//
// IT PUBLISHES RATHER THAN RENDERS, which is the whole point. Drawn in the body,
// this is a second header bar under the panel's own — two `border-bottom`s, two
// backgrounds, and the name printed twice — which is what every identity screen
// did. Handed up, it IS the panel's header.
//
// Null on unmount, so walking back to a parent does not leave a cover and a crumb
// naming the screen you just left.
export function usePanelHead(head) {
  const host = useContext(FormHostContext);
  const setHead = host?.setHead;
  const key = JSON.stringify([head?.crumb, head?.title, head?.art, head?.artKind]);
  useEffect(() => {
    if (!setHead) return;
    setHead(head);
    return () => setHead(null);
    // The identity of `head.slot` is a fresh element every render, so the deps are
    // the VALUES that decide what it draws — otherwise this republishes forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHead, key]);
  // Whether it landed anywhere, so a caller can draw the bar itself when it did
  // not — see ScreenHead.
  return !!setHead;
}

// useFormHost — what a form calls to join its dialog's header. Returns the host
// (or null when rendered inline) and reports why saving is blocked, if it is.
// `reason` is shown on the disabled ✓, so it stays inside the five-word rule;
// '' means ready, and unmounting hands back null so the button goes away with the
// form it belonged to.
export function useFormHost(reason) {
  const host = useContext(FormHostContext);
  const setBlocked = host?.setBlocked;
  useEffect(() => {
    if (!setBlocked) return;
    setBlocked(reason || "");
    return () => setBlocked(null);
  }, [setBlocked, reason]);
  return host;
}

// OPEN DEFAULTS TO TRUE, because mounting a dialog IS opening it.
//
// ---- the panel stack (§6.5) ----

// usePanelStack — the one idiom for a surface that opens another surface.
//
// The app reached ~30 surfaces from a work detail across SEVEN physical kinds
// (FormModal, MobileSheet, ConfirmDialog, three bare-scrim overlays, anchored
// popovers, inline blocks and two raw window.confirm calls), and a reader met
// three of them on one screen. A panel is a list of rows that may push another
// list of rows; that is one shape, so it gets one implementation.
//
// HISTORY IS THE STACK'S ONLY MUTATOR, and that is the whole design. Every push
// writes its depth into history.state; every close — the ✕, the ← key, the
// scrim, Escape, a row that answers its question — goes through history.back()
// or .go(-n) rather than calling setState. So the Back gesture and the header's
// own key are the same code path and cannot disagree, and a panel dismissed by
// ✓ can never leave an entry behind for Back to re-open. Reading the depth from
// the popped state rather than decrementing is what makes go(-n) correct:
// browsers coalesce a multi-step go into ONE popstate, so a handler that pops
// one level would strand the rest of the stack open with no entries left.
export function usePanelStack() {
  const [stack, setStack] = useState([]);
  // The handler is registered once and must not close over a stale stack.
  const depthRef = useRef(0);
  depthRef.current = stack.length;
  // The cancel function for an open() that is waiting for its pop. See open().
  const pendingOpen = useRef(null);

  // A PENDING OPEN DOES NOT SURVIVE THE SCREEN. Leaving mid-flight would
  // otherwise push a panel into a host that is gone.
  useEffect(() => () => {
    if (pendingOpen.current) pendingOpen.current();
  }, []);

  useEffect(() => {
    const onPop = (e) => {
      const want = e.state?.tpPanelDepth || 0;
      if (want < depthRef.current) setStack((s) => s.slice(0, want));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Leaving the screen with panels open would strand their entries, so the last
  // unmount walks back exactly as far as it pushed.
  useEffect(() => () => {
    const n = depthRef.current;
    if (n > 0 && window.history.state?.tpPanelDepth) window.history.go(-n);
  }, []);

  const push = useCallback((panel) => {
    setStack((s) => {
      const next = s.concat(panel);
      // Carried forward, not replaced: pushState REPLACES the state object, and
      // App keeps its own depth in there for the in-app Back.
      window.history.pushState(
        { ...window.history.state, tpPanelDepth: next.length }, "",
      );
      return next;
    });
  }, []);

  // open() is push() onto an empty stack — the prototype's openPanel, which
  // REPLACES rather than deepens, so a control that means "show me this" cannot
  // accidentally bury whatever a previous one left open.
  //
  // IT WAITS FOR THE POP RATHER THAN GUESSING AT IT, and the previous line —
  // `requestAnimationFrame(() => push(panel))` — is the bug this replaces. Its
  // own comment said "the push waits for the pop to land", which a frame callback
  // does not do: rAF fires before the next paint, `popstate` is dispatched by the
  // browser on its own schedule, and in Chromium the frame wins. So the push
  // landed first, the pop arrived second with `want = 0`, and the handler above
  // truncated away the panel that had just been opened.
  //
  // WHAT THAT COST, measured by pressing every control on the character panel:
  // "Open the global record", the performer's name and the person picker all
  // CLOSED the panel and opened nothing — three controls that read as unbuilt,
  // from one line. Every open() from inside a panel had it; only an open() from a
  // screen with nothing already open was unaffected, which is why the surfaces
  // reached straight off a card always worked and the ones a panel offers never
  // did.
  //
  // A one-shot popstate listener is the fix: the stack's own handler is
  // registered first, so it has already truncated by the time this one pushes.
  //
  // AND THERE IS NO TIMEOUT BEHIND IT, though there was — a 250ms
  // `setTimeout(land, 250)` "belt" whose own comment claimed it saved a press
  // when `go` could not move. It could not, and the discriminator below is why:
  // `land` pushes only onto an EMPTY stack, so the one case the timer was
  // supposed to cover — no pop arrived, stack still n deep — is the case where
  // it abandons. When the pop did arrive the listener had already settled it.
  // Dead on both branches, and not harmlessly: its firing was the one path by
  // which a stack emptied by something else (a ✕ pressed in the window) could be
  // handed back the panel the reader had just dismissed. `go(-n)` cannot fail to
  // move here anyway — reaching this branch means `push` wrote n entries.
  const open = useCallback((panel) => {
    const n = depthRef.current;
    if (n === 0) {
      push(panel);
      return;
    }
    // ONE PENDING OPEN AT A TIME, CANCELLED ON UNMOUNT, AND ONLY THE POP WE
    // ASKED FOR COUNTS. Three failures come from getting any of those wrong, and
    // the first version of this fix had all three:
    //
    //   UNMOUNTED IN THE WINDOW. `land` still fired, pushed, and wrote a
    //   tpPanelDepth into history with no host mounted — the URL unchanged, so
    //   the reader gained a phantom entry whose Back press changes nothing they
    //   can see. `cancel` on unmount is what stops it.
    //
    //   A BACK PRESS IN THE WINDOW. `land` ran on the FIRST popstate to arrive,
    //   whoever caused it, so pressing Back opened a panel instead of closing
    //   one. The depth test below is the discriminator: our own `go(-n)` lands
    //   with the stack empty, and any other pop does not.
    //
    //   A DOUBLE TAP. Two opens each registered a lander and one pop satisfied
    //   both, giving depth 2 where open() promises 1 — the property this
    //   function exists for. The second call cancels the first.
    if (pendingOpen.current) pendingOpen.current();
    let settled = false;
    const stop = () => {
      settled = true;
      window.removeEventListener("popstate", land);
      if (pendingOpen.current === cancel) pendingOpen.current = null;
    };
    const cancel = () => {
      if (!settled) stop();
    };
    function land() {
      if (settled) return;
      stop();
      // THE STATE DECIDES WHETHER THIS POP WAS OURS, not the ref. `depthRef` is
      // assigned during RENDER, and the stack's own popstate handler runs before
      // this one and only calls setStack — so at this moment the ref still holds
      // the depth from before the pop, and testing it here rejected every pop
      // including ours. The functional setter sees the truncation that actually
      // happened: our `go(-n)` empties the stack, and a pop somebody else caused
      // (a Back press between the `go` and its pop, another stack's close)
      // leaves something on it. Where it does, their intent wins and this open
      // is abandoned rather than pushed on top of wherever they went.
      setStack((cur) => {
        if (cur.length !== 0) return cur;
        window.history.pushState(
          { ...window.history.state, tpPanelDepth: 1 }, "",
        );
        return [panel];
      });
    }
    window.addEventListener("popstate", land);
    pendingOpen.current = cancel;
    window.history.go(-n);
  }, [push]);

  const back = useCallback(() => {
    if (depthRef.current > 0) window.history.back();
  }, []);

  const close = useCallback(() => {
    const n = depthRef.current;
    if (n > 0) window.history.go(-n);
  }, []);

  return { stack, top: stack[stack.length - 1] || null, open, push, back, close };
}

// PanelHost — the chrome every panel wears. Scrim, three-slot header, one
// scrolling body.
//
// THE HEADER IS THREE SLOTS because the title is centred on the BOX and not on
// the space left over: two equal flexible sides, each reserving the 44px a key
// needs, so the title does not shift as you walk the stack. Everything in the
// head shares one 44px line box — a back key and a title sitting a few pixels
// apart vertically is the tell of a header assembled from parts.
//
// THE HEADER CASTS, UNCONDITIONALLY. A 1px rule alone made the body look like it
// passed THROUGH the header rather than under it, and a shadow that appears on
// scroll is a layer changing depth while you read.
//
// NO ✕ ON A NESTED PANEL. Its two exits are "answer" and "back": a ✕ there
// closed the whole stack and discarded the half-filled surface underneath, which
// is a destructive key wearing a dismiss key's clothes. The right slot still
// reserves its 44px, so the title does not move when the key goes.
export function PanelHost({ stack }) {
  const { stack: levels, back, close } = stack;
  const panel = levels[levels.length - 1] || null;
  const nested = levels.length > 1;
  const parent = nested ? levels[levels.length - 2] : null;
  // THE PARENT'S NAME SCROLLS RATHER THAN ENDING IN AN ELLIPSIS. It used to read
  // "← Charles F…", and a shortened name and a short name look alike — which is
  // the one failure a reader cannot detect, and the reason the cast row's
  // character name works exactly this way (see .cast-character).
  //
  // A DRAG INSIDE A BUTTON IS SAFE HERE and was not always: useEdgeScroll takes
  // its pointer capture only after 3px of movement, so a press-and-release still
  // reaches the button and only a real drag scrolls — the same fix that stopped
  // every scroller in the app eating its own clicks.
  const backWord = useRef(null);
  const titleRef = useRef(null);
  useEdgeScroll(backWord, { axis: "x" });
  // The title is a name too — the panel is named after the person, character or
  // work it is about — so it gets the same treatment rather than an ellipsis.
  useEdgeScroll(titleRef, { axis: "x" });
  useBodyScrollLock(!!panel);
  // A PANEL CAN HOST A FORM, and it has to, or a form moved onto this stack loses
  // its save key without a word.
  //
  // A form does not draw its own ✓. `useFormHost` registers the form with
  // whatever chrome is above it, takes that chrome's id to wear on its <form>,
  // and reports a REASON it cannot be saved yet (or "" for ready); the chrome
  // draws one submit key bound to that id. Until now the only chrome that did
  // this was FormModal, so moving WorkDetails onto the panel stack would have
  // returned null from useFormHost, left the <form> with no id, and silently
  // deleted the one control that commits every open row in a single request.
  //
  // IT CANNOT BE THE DESCRIPTOR'S `headVerb`. That is a value captured in the
  // immutable stack entry when the panel is pushed, and this key has to react to
  // a `blocked` reason the form reports while it is open.
  const formId = useId();
  const [blocked, setBlocked] = useState(null); // null = no form registered
  // ---- A DISMISSAL MUST NOT DISCARD WHAT YOU TYPED --------------------------
  //
  // Every close route was unconditional: the ✕, the scrim, Escape, the back
  // gesture. The Details panel is a stack of self-saving rows, so a reader who
  // has opened three of them and typed in all three loses all three to one click
  // outside the panel — no question, no toast, nothing.
  //
  // The machinery to know better already existed and was never read on close:
  // useUnsavedFields keeps a registry of dirty rows and reports a count, and the
  // panel's own header uses it to decide whether to draw the ✓. Content publishes
  // that count here, and the close routes ask before throwing it away.
  //
  // A COUNT RATHER THAN A BOOLEAN, because the question is worth asking with a
  // number in it: "three fields have unsaved changes" is a different decision
  // from "one".
  const [dirty, setDirty] = useState(0);
  const [asking, setAsking] = useState(false);
  // THE PACK'S HEADER IS THE PANEL'S OWN, and publishing it works the way the
  // dirty count already does: the body knows the record, the head draws it.
  //
  // WHAT THIS ENDS. Every identity screen drew `ScreenHead` — cover, name, crumb,
  // its own `border-bottom` — as the first thing in a panel BODY whose head had
  // already drawn the name and a ✕ above it. Two styled header bars, stacked, one
  // of them repeating the other's only word. The pack has one
  // (`character-popup.dc.html:33`) and it is this one: the cover with the medium
  // glyph laid over it in the slot a back key would otherwise hold, the title with
  // the crumb under it, and the ✕.
  const [head, setHead] = useState(null);
  const host = useMemo(() => ({ formId, setBlocked, setDirty, setHead }), [formId]);
  // guarded wraps a close route. Nothing to lose → it just runs.
  const guard = useCallback((run) => () => (dirty > 0 ? setAsking(() => run) : run()), [dirty]);
  // AND SO DOES A HEAD. Walking back to a parent leaves the child's cover and
  // crumb in the bar otherwise, which is worse than none: it names a screen you
  // have left.
  // A reason belongs to the panel that reported it. Walking back to a parent that
  // holds no form must not leave the child's ✓ — or its disabled tooltip — behind.
  //
  // RESET DURING RENDER, NOT IN AN EFFECT, and the ordering is the whole reason.
  // A child's effects run BEFORE its parent's, so an effect keyed on the depth
  // would fire immediately after the form inside registered itself and undo it —
  // which is exactly what the first version did: the panel opened, the form
  // reported ready, and the ✓ was wiped in the same commit. Comparing against the
  // last-seen depth in render happens before any child effect has run.
  const depth = levels.length;
  const [seenDepth, setSeenDepth] = useState(depth);
  if (seenDepth !== depth) {
    setSeenDepth(depth);
    setBlocked(null);
    // The head goes with it, for the same reason and by the same clock.
    setHead(null);
    // DIRT IS NOT RESET HERE, and the first version's attempt to is worth the
    // sentence. `blocked` belongs to whichever panel is on top, so it is cleared
    // whenever the depth moves. Dirt belongs to the CONTENT — and the content
    // already zeroes it on unmount, so walking to another panel clears it by the
    // right mechanism.
    //
    // Resetting it on a depth change was actively wrong: `open()` walks history
    // back before it pushes, so the depth settles over more than one commit. The
    // content mounted, published its count, and a later depth change wiped it —
    // after which no dismissal asked about anything, because the reset ran once
    // more than the content's effect did. Every dirty case failed and every clean
    // one passed, which is the shape of a lifecycle bug rather than a logic one.
  }
  // ONE OWNER FOR ESCAPE — see useEscape. `back()` rather than `close()` is the
  // pack's ladder: one layer at a time, so a panel opened from a panel returns to
  // the one it came from instead of dropping the whole stack.
  //
  // GUARDED, like every other way out. Escape is the fastest of them and the one
  // most likely to be pressed by reflex.
  useEscape(!!panel && !asking, guard(back));
  if (!panel) return null;
  // A panel that declares its own verb carries it in the head — Links' ＋. Only
  // ever the panel's OWN verb: the list is what is already there, and adding to
  // it is not another member of it.
  const verb = panel.headVerb || null;
  return createPortal(
    <div
      className="tp-scrim tp-panel-scrim fixed inset-0 z-50 flex justify-center"
      onMouseDown={backdropClose(() => guard(close)())}
    >
      <div
        // HOW MUCH IS AT STAKE, on the element, because there is no other way to
        // see it. The count lives in this component's state and reaches the DOM
        // only as the presence or absence of a question — so a test that wants to
        // act AFTER the content has published it has nothing to wait for, and
        // waits on a timer instead. A timer in a test is a guess that passes on a
        // fast machine. The browser harness can read this too.
        data-dirty={dirty || undefined}
        role="dialog"
        aria-modal="true"
        aria-label={panel.title}
        className="tp-panel"
        style={panel.wide ? { width: "min(900px, 100%)" } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={"tp-panel-head" + (head ? " has-scope" : "")}>
          <div className="tp-panel-slot">
            {nested ? (
              <button
                type="button"
                className="tp-panel-back tactile"
                aria-label={t("common.panel.back.aria", { title: parent.title })}
                onClick={back}
              >
                <IconBack />
                <span className="tp-panel-back-word" ref={backWord}>{parent.title}</span>
              </button>
            ) : head?.slot || null}
          </div>
          {head ? (
            /* LEFT-ALIGNED BESIDE THE COVER, not centred. A centred title over a
               32px thumbnail reads as a caption for the thumbnail; the pack sets
               the pair as one block that starts where the cover ends. */
            <span className="tp-panel-names">
              {/* THE RECORD'S NAME WINS over the one the opener passed. A panel is
                  opened with the name printed on whatever was pressed, and a
                  record renamed since — on its own global screen, one panel
                  back — would leave the header saying what it used to be. */}
              <NameScroll as="h2" className="tp-panel-title is-scoped">{head.title || panel.title}</NameScroll>
              {head.crumb ? <span className="tp-panel-crumb">{head.crumb}</span> : null}
            </span>
          ) : (
            <h2 className="tp-panel-title" ref={titleRef}>{panel.title}</h2>
          )}
          <div className="tp-panel-slot tp-panel-slot-r">
            {/* Before the panel's own verb and before the ✕: the order is
                commit, then add, then leave.

                THE ARMED SLOT AND THE COUNT ARE THE SAME ONES `FormModal` DRAWS,
                and until now this head drew a plain ✓ that never changed. That is
                only half the standing rule — the tick is supposed to take the
                accent fill AND a badge counting what the press will write, "the
                moment the substance differs from what is stored", because a
                control that looks identical armed and unarmed teaches the reader
                to stop reading it. A panel is where most of this app's editing
                happens, so the half that was missing was the half that mattered:
                the Details panel is a stack of self-saving rows and its head said
                nothing about how many of them were waiting.

                `dirty` is the panel's own count, published by its content through
                `setDirty` and already driving the unsaved question below — so the
                number was on hand the whole time and only the drawing was
                missing. */}
            {blocked !== null && (
              <span className={"tp-tick-slot" + (dirty > 0 ? " is-armed" : "")}>
                <IconButton
                  icon={<IconCheck />}
                  type="submit"
                  form={formId}
                  ariaLabel={t("common.action.save.label")}
                  tooltip={blocked || panel.saveTip || t("common.action.save.label")}
                  disabled={!!blocked}
                  style={{ width: 34, height: 34, padding: 0, flexShrink: 0 }}
                  wrapClassName="shrink-0"
                />
                {dirty > 0 ? <span className="tp-tick-count" aria-hidden="true">{dirty}</span> : null}
              </span>
            )}
            {verb}
            {!nested && (
              /* AND THE CROSS IS RED WHEN IT IS THE DISCARDING HALF. "The cross
                 is red… the repo's danger colour is how the app says so
                 everywhere else" — but only where there is a pair to be half of.
                 A panel holding no form has no ✓ beside it and its ✕ is a plain
                 way out, so painting that one red would warn about closing a list
                 of rows.

                 NOT GATED ON `dirty`, AND IT WAS. Two surfaces drew this pair by
                 two rules: here the ✕ went red only once something had been
                 typed, while `FormModal` and `MobileSheet` red it for any caller
                 passing `closeDanger` — and all three of those callers pass it
                 unconditionally. So one form's ✕ answered a different question
                 from another's, on adjacent screens.

                 THE `dirty` GATE BELONGS TO THE TICK AND ONLY TO IT. The tick's
                 arming says SOMETHING HAS CHANGED; the cross's colour says WHAT
                 THIS PRESS DOES. Making both depend on the same fact gives the
                 reader one signal twice and no signal at all for the second
                 question — and it means a reader who has typed nothing cannot
                 tell a form they may leave freely from a form at all. */
              <IconButton
                icon={<IconClose />}
                ariaLabel={t("common.action.close.label")}
                tooltip={t("common.form.close.tip")}
                onClick={guard(close)}
                style={blocked !== null ? { color: 'var(--error)' } : undefined}
              />
            )}
          </div>
        </div>
        <Scroller axis="v" className="tp-panel-body">
          <FormHostContext.Provider value={host}>
            {typeof panel.render === "function" ? panel.render() : panel.render}
          </FormHostContext.Provider>
        </Scroller>
      </div>
      {/* THE QUESTION, asked only when there is something to lose. It renders
          inside the panel's own scrim so it sits above it, and it registers with
          the Escape ladder AFTER the panel — so Escape dismisses the question and
          leaves the panel and its drafts exactly where they were, which is the
          answer a reflex press should get. */}
      <ConfirmDialog
        open={!!asking}
        title={t("common.unsaved.title")}
        body={t("common.unsaved.prose", { n: dirty, count: dirty })}
        confirmLabel={t("common.unsaved.discard.label")}
        onConfirm={() => {
          const run = asking;
          setAsking(false);
          setDirty(0);
          run?.();
        }}
        onCancel={() => setAsking(false)}
      />
    </div>,
    document.body,
  );
}

// It did not, and two call sites paid for it: Settings' in-depth quiz panel and
// the search filters panel both render this inside a `{cond && <FormModal …>}`
// guard and pass no `open`, so both returned null and NEITHER DIALOG HAD EVER
// APPEARED. The guard is not the mistake — it is how the rest of the app mounts
// a conditional subtree, and the twenty-three sites that pass `open` explicitly
// are the ones keeping a persistent instance around. The primitive was the
// mistake: a prop whose absence renders nothing, silently, is a trap and not an
// API. Both idioms work now, and the effects below still key off `open` so a
// persistent instance closes exactly as it did.
// `saveTip` overrides the ✓'s tooltip for a dialog whose ✓ does more than save —
// the work Details panel's, which commits every open row AND closes the panel, so
// "Save" undersells it by half. A PROP rather than a second channel through the
// form-host context: the dialog and the form that registers with it are written
// in the same file at every call site, so the caller always knows.
// `dirty` and `closeDanger` ARE THE STANDING TICK/CROSS RULE, arriving one caller
// at a time. CLAUDE.md now states it: a tick lights — accent fill, and a badge
// counting what the press will change — only once the substance differs from
// what is stored, and the cross is red because it is the discarding half. Both
// are OPTIONAL and default to the behaviour every existing modal already has, so
// this commit changes no screen but the one it adds. Flipping the defaults is the
// sweep the owner has deferred, and it belongs here rather than in each caller:
// this component draws the pair for every form in the app.
//
// `dirty` is a COUNT, not a boolean, because the badge shows it. undefined means
// "the caller does not track it" and the tick behaves as it always did.
// ---- the scrim every dialog in this app sits on ----------------------------
//
// NINE COPIES OF ONE CLASS LIST, in seven files, and the list is not decorative:
// `.tp-scrim` is what carries `overscroll-behavior: contain`, so a wheel that
// runs past the end of a dialog stops there instead of moving the page behind
// it, and `px-4 py-10` is the room a dialog gets on a phone. A copy that drifts
// does not look broken — it scrolls the page you cannot see, and you find out
// when you close it.
//
// TWO SHAPES, BECAUSE THERE ARE GENUINELY TWO. A dialog that centres its card
// horizontally and one that lets the card fill the width are different layouts,
// not a variant of one. Everything else about the nine was identical.
export const SCRIM = "tp-scrim fixed inset-0 z-50 overflow-y-auto px-4 py-10";
export const SCRIM_CENTERED = `${SCRIM} flex items-start justify-center`;

// backdropClose — dismiss when the press lands on the scrim ITSELF, never on a
// press that started inside the card and drifted out. `e.target === e.currentTarget`
// is the whole of that, and writing it nine times is nine chances to write
// `e.target === e.target`. `when` is for the callers that refuse to close while
// a save is in flight.
export const backdropClose = (onClose, when = true) => (e) => {
  if (when && e.target === e.currentTarget) onClose?.();
};

export function FormModal({ open = true, onClose, title, maxWidth = 560, saveTip, dirty, closeDanger = false, children }) {
  const mobile = useIsMobileScreen();
  useBodyScrollLock(open);
  // Desktop only: the mobile branch below renders MobileSheet, which takes the
  // Back entry for itself. Two markers for one dialog is two presses to close it.
  useBackToClose(open && !mobile, onClose);
  const formId = useId();
  // null = no form has registered, so there is nothing to commit and no ✓.
  const [blocked, setBlocked] = useState(null);
  const host = useMemo(() => ({ formId, setBlocked }), [formId]);
  // ONE OWNER FOR ESCAPE — see useEscape.
  useEscape(open, () => onClose && onClose());
  // A closed dialog holds no form, so its last blocked reason must not survive
  // into the next thing opened under the same instance.
  useEffect(() => { if (!open) setBlocked(null); }, [open]);
  if (!open) return null;
  // A tick that looks armed when nothing has changed teaches the reader to stop
  // reading it, so the accent and the badge both wait for a real change.
  const armed = typeof dirty === 'number' && dirty > 0;
  const save = blocked === null ? null : (
    <span className={'tp-tick-slot' + (armed ? ' is-armed' : '')}>
      <IconButton
        icon={<IconCheck />}
        type="submit"
        form={formId}
        ariaLabel={t("common.action.save.label")}
        tooltip={blocked || saveTip || t("common.action.save.label")}
        disabled={!!blocked}
        style={{ width: 34, height: 34, padding: 0, flexShrink: 0 }}
        wrapClassName="shrink-0"
      />
      {armed ? <span className="tp-tick-count" aria-hidden="true">{dirty}</span> : null}
    </span>
  );
  if (mobile) {
    return createPortal(
      <MobileSheet open={open} onClose={onClose} title={title} actions={save} closeDanger={closeDanger}>
        <FormHostContext.Provider value={host}>{children}</FormHostContext.Provider>
      </MobileSheet>,
      document.body,
    );
  }
  // Portal to <body> so the overlay escapes any card's stacking context — an
  // edit modal opened from a masonry tile must sit above every sibling tile
  // (a .hand-card is `isolation: isolate`, so an in-tree modal is trapped and
  // later tiles paint over it).
  return createPortal(
    <div className={SCRIM_CENTERED} onMouseDown={backdropClose(onClose)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="hand-card hc-r2 w-full"
        style={{ maxWidth, padding: "18px 20px 20px" }}
      >
        <div className="mb-3 flex items-center gap-2">
          <h2 className="display-title flex-1" style={{ fontSize: 'var(--type-ui-19)' }}>
            {title}
          </h2>
          {save}
          <IconButton
            icon={<IconClose />}
            ariaLabel={t("common.action.close.label")}
            tooltip={t("common.form.close.tip")}
            onClick={onClose}
            style={{
              width: 34, height: 34, padding: 0, flexShrink: 0,
              ...(closeDanger ? { color: 'var(--error)' } : null),
            }}
            wrapClassName="shrink-0"
          />
        </div>
        <FormHostContext.Provider value={host}>{children}</FormHostContext.Provider>
      </div>
    </div>,
    document.body,
  );
}

// LONG_PRESS_MS — how long a thumb has to rest on a control before its label
// appears. 500ms is the platform long-press convention, and the margin matters
// more than it looks: a fired long-press SWALLOWS the click behind it (holding
// a Delete button to find out what it does must not delete anything), which is
// what Material does too — but it means a merely slow tap that crosses the
// threshold silently does nothing. 500ms keeps that out of ordinary tapping.
const LONG_PRESS_MS = 500;

// HOVER_TIP_MS — how long a pointer has to REST on a control before its label
// appears.
//
// It used to be nothing: pointerenter showed the bubble on the same frame, which
// reads as the app answering a question nobody asked. The report is exactly that —
// "now they are instantaneous and thus irritating" — and the irritation is not the
// label, it is the labels you never wanted: crossing the top bar to reach the ＋
// fires five bubbles on the way, each a flash of text where you were about to look.
//
// A DELAY IS A TEST OF INTENT, and 400ms is about where it sits on every platform
// that has one. Long enough that passing over a control costs nothing, short
// enough that stopping ON one does not feel like waiting. Below roughly 250 it
// stops filtering the pass-through; past roughly 600 you start noticing yourself
// hovering.
//
// KEYBOARD FOCUS IS NOT DELAYED, and that is deliberate rather than an oversight.
// Tabbing to a control IS the question — there is no passing over one with a
// keyboard, so there is no intent left to test, and a delay there would only be a
// pause between the press and the answer.
const HOVER_TIP_MS = 400;
// How far a finger may drift and still count as a press rather than a scroll.
const LONG_PRESS_SLOP = 10;
// HOVER_REST_SLOP — how far a POINTER may drift and still count as resting.
//
// The delay above was a test of presence, not of intent, and those are only the
// same thing when events arrive on time. Crossing the top bar fast still raised
// bubbles, late, over whatever the pointer had moved on to: pointerenter starts
// the clock, the pointer sweeps on, and if the matching pointerleave is delayed
// — by a busy main thread, by pointer-event coalescing, by the control moving
// under the cursor — the clock finishes anyway and shows a label for a control
// nobody is pointing at any more. The reader's report is exactly that shape:
// "it still appears and is lagging behind ... the hover delay is thus rendered
// useless".
//
// So the clock now measures REST. Any move beyond this slop restarts it, which
// makes the rule "the pointer has been within 8px of one spot for 400ms" rather
// than "the pointer arrived 400ms ago" — and a sweep, which is nothing but
// movement, can no longer complete one no matter what pointerleave does. 8px is
// wider than a resting hand's jitter and far narrower than a traverse.
const HOVER_REST_SLOP = 8;

// Tooltip — an on-brand label bubble that replaces native title= tooltips, on
// every device. ONE bubble serves both input styles (HintBubble, placed by
// showHint / hintToast below); only what opens and closes it differs:
//
//   pointer  hover, or keyboard focus. Closes when the pointer leaves.
//   touch    press and hold for 500ms. Closes on its own after HINT_MS — there
//            is no "leave" on a finger that has already lifted.
//
// Until 1.4.1 the two were separate mechanisms: a CSS bubble absolutely
// positioned inside this wrapper for hover, and a pill pinned to the top of the
// screen for touch. Both were wrong in the same way — neither could be kept
// inside the viewport. The CSS bubble hanging off a control near the right edge
// widened the page's scrollable area (an opacity-0 bubble still has a border
// box), and the touch pill was centred with left:50% + translateX(-50%), which
// cannot be clamped at all; between them Library and Settings could be panned
// sideways into blank space on a phone. The pill was also detached from its
// control, so it answered "what is this?" without saying which "this" — and
// several 44px glyphs sit within a thumb's width of each other in these bars.
//
// The replacement is measured and placed in script, anchored to the control, and
// clamped on both axes, so it is always wholly on screen and always attributable.
//
// A fired long-press swallows the click that follows it: holding a Delete button
// to find out what it does must never also delete the thing.
// `onContextMenu` is the OPT-OUT, and it is an opt-out from doing nothing rather
// than from the suppression below — see the comment on that line for why the
// suppression itself never lifts. A wrapped control that wants a right-click
// gesture of its own passes a handler here; it still gets no platform menu and
// still does not open the card menu it may be sitting inside.
// HOVER_HIDE_MS — how long a hover bubble stays up on its own.
//
// It exists because pointerleave is not a promise. The bubble opened on
// pointerenter and closed on pointerleave and nothing else, which is correct
// right up until the thing under the pointer stops being there: press a colour
// swatch and the picker re-renders, a panel opens over the control, the row
// reflows — and the leave event that was going to close this never arrives. The
// label then sits over the screen indefinitely, obscuring the very thing you
// clicked it to change.
//
// Three seconds: long enough to read a five-word label twice, short enough that
// a stuck one is gone before you reach to get rid of it. Six was tried first and
// read as broken — a label you have finished with is in the way immediately.
const HOVER_HIDE_MS = 3000;

// `shortcut` is an ACTION ID from keys.js, not a key string. The registry owns
// the binding and the bubble reads it, so a key changed in one place changes the
// label on every control that runs that action — which is the whole of the
// owner's rule that a shortcut "must always be spelled out in the corresponding
// button's tooltip". Passing an id with no binding leaves the label untouched,
// so any Tooltip can name an action speculatively.
export function Tooltip({ label, side = "top", className = "", onContextMenu, shortcut, shiftKey = false, children }) {
  // The key is dropped from the bubble on a phone, for the reason Kbd gives: the
  // rule is that a shortcut must be spelled out on the control that shares its
  // job, and its purpose is teaching a binding to somebody who can press it.
  // "Search · /" on a touch screen is half a label spent on a key with no board.
  // The LABEL still shows — only the suffix goes.
  label = useIsMobileScreen() ? label : withShortcut(label, shortcut, shiftKey);
  const timer = useRef(null);
  // The hover-intent timer, kept APART from `timer` above rather than sharing it.
  // The two never run together — one is touch and one is pointer — but they are
  // cancelled by different things: a long press dies when the finger slides
  // (onPointerMove), and a mouse moving WITHIN a control must cancel nothing. One
  // ref would have to answer both, and the guard that lets a flick kill a long
  // press would then let a wobbling hand kill every tooltip in the app.
  const hover = useRef(null);
  const origin = useRef(null);
  const fired = useRef(false);
  const wrap = useRef(null);
  // The hint slot's token for the bubble THIS tooltip opened, so closing only
  // closes our own — moving between two adjacent controls interleaves an enter
  // and a leave, and a blind "hide" would race the new label away.
  const held = useRef(0);
  // Where the pointer was when the current rest clock started, and whether a
  // pointerleave has been seen since it started. The second is a belt to the
  // first's braces: rest cannot complete during a sweep, and if one somehow did,
  // a control the pointer has already left must not speak.
  //
  // ABOVE THE `if (!label)` RETURN, with every other hook in this component. A
  // ref declared below it runs on some renders and not others, which React
  // reports as "rendered more hooks than during the previous render" three
  // screens away from the line that caused it.
  const restAt = useRef(null);
  const inside = useRef(false);
  // Unmount is a close: clicking a control that opens a modal takes the wrapper
  // (and its pointerleave) with it, which would otherwise pin the label forever.
  useEffect(() => () => {
    clearTimeout(hover.current);
    hideHint(held.current);
  }, []);
  if (!label) return children;

  // An open InfoDot / Help sheet suppresses its own trigger's bubble: the tap
  // that opened the panel also leaves the trigger hovered or focused, and the
  // bubble would repeat the same words over the panel showing them.
  const suppressed = /(?:^|\s)is-open(?:\s|$)/.test(className);
  const box = () => {
    const r = wrap.current?.getBoundingClientRect();
    return r && r.width ? r : null;
  };
  // `auto` is false for keyboard focus: somebody reading a label with the
  // keyboard has not asked for it to vanish mid-sentence, and their bubble is
  // closed by blur, which — unlike pointerleave — always arrives.
  // `auto` is the hover path and takes the cap; keyboard focus holds, and is
  // closed by blur. The timer itself is the HOST's now — one mechanism for every
  // bubble, rather than one this component remembered and Toggle did not.
  const open = (auto = false) => {
    if (suppressed) return;
    hideHint(held.current);
    held.current = showHint(label, box(), side, !auto);
  };
  const close = () => {
    hideHint(held.current);
    held.current = 0;
  };

  const clear = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };
  const clearHover = () => {
    clearTimeout(hover.current);
    hover.current = null;
    restAt.current = null;
  };
  const startRest = (e) => {
    clearHover();
    restAt.current = { x: e.clientX, y: e.clientY };
    hover.current = setTimeout(() => {
      hover.current = null;
      if (!inside.current) return;
      // open() reads the box when it runs, which is the same reason the long press
      // reads it at fire time: four tenths of a second is long enough for a list to
      // still be settling, and a bubble anchored to where the control WAS points at
      // nothing.
      open(true);
    }, HOVER_TIP_MS);
  };

  const onPointerEnter = (e) => {
    // Touch fires pointerenter too, on the tap — that path is the long press.
    if (e.pointerType === "touch" || suppressed) return;
    inside.current = true;
    startRest(e);
  };
  const onPointerDown = (e) => {
    if (e.pointerType !== "touch") return;
    fired.current = false;
    origin.current = { x: e.clientX, y: e.clientY };
    clear();
    timer.current = setTimeout(() => {
      fired.current = true;
      if (suppressed) return;
      // Read the box at FIRE time, not at press time: the hold lasts half a
      // second and a list can still be settling under the finger.
      hintToast(label, box(), side);
    }, LONG_PRESS_MS);
  };
  const onPointerMove = (e) => {
    // THE POINTER PATH: still travelling, so the clock starts again. This is
    // what makes the delay a test of intent rather than of arrival — see
    // HOVER_REST_SLOP.
    if (e.pointerType !== "touch") {
      if (!hover.current || !restAt.current) return;
      if (
        Math.abs(e.clientX - restAt.current.x) > HOVER_REST_SLOP ||
        Math.abs(e.clientY - restAt.current.y) > HOVER_REST_SLOP
      ) {
        startRest(e);
      }
      return;
    }
    // A drag is a scroll, not a question. Let go of the timer as soon as the
    // finger leaves the control, or every flick down a list would flash a label.
    if (!timer.current || !origin.current) return;
    if (
      Math.abs(e.clientX - origin.current.x) > LONG_PRESS_SLOP ||
      Math.abs(e.clientY - origin.current.y) > LONG_PRESS_SLOP
    ) {
      clear();
    }
  };
  const onClickCapture = (e) => {
    if (!fired.current) {
      // A CLICK ANSWERS THE QUESTION. You hovered to find out what the control
      // does and then pressed it, so the label has done its job — and this is
      // the one moment we know for certain the pointer was here, which
      // pointerleave may never tell us if the control moves or is covered.
      //
      // AND IT CANCELS A PENDING ONE. Pressing a control inside the delay must not
      // leave a bubble to arrive afterwards, over whatever the press just opened.
      clearHover();
      close();
      return;
    }
    fired.current = false;
    e.preventDefault();
    e.stopPropagation();
  };
  // Keyboard focus only. A tap also focuses, and matching :focus-visible is what
  // separates the two without guessing at the input device.
  const onFocus = (e) => {
    let keyboard = false;
    try {
      keyboard = !!e.target.matches?.(":focus-visible");
    } catch {
      keyboard = false; // engine without :focus-visible — stay quiet
    }
    if (keyboard) open();
  };

  return (
    <span
      ref={wrap}
      className={`tp-tip-wrap ${className}`}
      onPointerEnter={onPointerEnter}
      onPointerLeave={() => { inside.current = false; clear(); clearHover(); close() }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clear}
      onPointerCancel={() => { inside.current = false; clear(); clearHover(); close() }}
      onClickCapture={onClickCapture}
      onFocus={onFocus}
      onBlur={close}
      // LOAD-BEARING, and for one thing rather than the two this comment used
      // to claim. On Android, long-pressing a wrapped control otherwise raises
      // the text-selection handles or the platform context menu over the label
      // we just showed; on desktop it raises the browser's menu over whatever
      // the control was about to do. That is what preventDefault is for, and it
      // is why this line never lifts.
      //
      // IT IS NOT WHAT KEEPS A CARD'S MENU SHUT. The note here used to say it
      // was, and the test written against that claim failed: preventDefault
      // suppresses the DEFAULT, not the propagation, so a right-click on a
      // card's share glyph does still reach useCardMenu. What turns it away
      // there is useCardMenu's own `onControl(e.target)` guard
      // (MENU_IGNORE_SELECTOR). Both mechanisms are real and both are needed —
      // this one stops the browser's menu, that one stops the card's — but they
      // are separate, and believing this line does both work is how somebody
      // eventually deletes the guard that actually does.
      //
      // A CONTROL WITH ITS OWN RIGHT-CLICK GESTURE ADDS TO THIS, IT DOES NOT
      // REPLACE IT. preventDefault still runs, so it still gets no platform
      // menu. stopPropagation is added for it specifically: a control that has
      // claimed the gesture should own it outright rather than depend on every
      // ancestor's guard being written correctly. The handler is called last,
      // once the event has been made safe — an opt-out that simply skipped this
      // line would hand the Android bug back to every caller that wanted one.
      onContextMenu={(e) => {
        e.preventDefault();
        if (!onContextMenu) return;
        e.stopPropagation();
        onContextMenu(e);
      }}
    >
      {children}
    </span>
  );
}

// ---- anchored popups --------------------------------------------------------
//
// One placement primitive for every dropdown, menu and suggestion list.
//
// THE BUG THIS EXISTS FOR. Every popup in the app used to place itself in CSS:
// `position: absolute; top: calc(100% + 4px)`. That is right exactly once — when
// there is room below the trigger. Open a Select near the bottom of a phone
// screen and the panel rendered below the fold, so choosing an option meant
// scrolling the page to reach options that were supposed to be in front of you.
// A menu you have to go looking for is a menu that has failed.
//
// CSS cannot fix it, and not for want of a clever rule: to know it is off the
// screen a popup has to measure the VIEWPORT, and an absolutely-positioned
// element is placed against its offset parent, which knows nothing about where
// on the screen it ended up. Anchor positioning would do it natively and is not
// yet safe to rely on. So placement moves into JS, and with it the popup moves
// into a portal — a card that sets `container-type` or `transform` is a
// containing block and a stacking context, and a popup inside one cannot escape
// its own card however it is positioned.
//
// What placement means here, in order of how much each part matters:
//
//   flip    prefer the requested side; take the other when the preferred one
//           cannot fit the content AND the other has more room. Not "flip
//           whenever it does not fit", which thrashes a popup between sides
//           when neither side fits.
//   clamp   both axes, into the viewport with a margin. A menu opened from a
//           corner slides along the edge rather than hanging off it.
//   cap     max-height to the room actually available, so a long list scrolls
//           ITSELF instead of running off the screen. This is the half that
//           matters most on a phone, where flipping alone still leaves a
//           40-option list taller than the window.
//
// Measurement uses scrollHeight, not offsetHeight: once a cap has been applied
// the element's own height is the capped one, so re-measuring it would ratchet
// the popup smaller on every scroll event.

export const POPUP_MARGIN = 8; // clearance kept from every viewport edge
export const POPUP_GAP = 4; // between the trigger and the popup

// placeAnchored — the whole decision, as arithmetic.
//
// Pure and exported because jsdom measures nothing: every rect it reports is
// zeros, so a test driving this through the hook would assert that 0 fits
// inside 0. The maths is the part that can be wrong — which side, how tall,
// how far along the edge — so it is separated from the DOM that supplies the
// numbers and tested directly.
//
//   anchor  {top,bottom,left,right,width} of the trigger, viewport coordinates
//   vp      {w,h} of the viewport
//   wanted  the popup's natural (uncapped) height
//   popW    the popup's natural width
export function placeAnchored(anchor, vp, wanted, popW, opts = {}) {
  const {
    prefer = "below",
    matchWidth = false,
    align = "start",
    gap = POPUP_GAP,
    minHeight = 120,
    margin = POPUP_MARGIN,
  } = opts;

  const roomBelow = vp.h - anchor.bottom - gap - margin;
  const roomAbove = anchor.top - gap - margin;

  // Flip only when the preferred side cannot fit the content AND the other side
  // is roomier. "Flip whenever it does not fit" thrashes the popup between
  // sides when neither fits, which is the common case for a long list on a
  // phone — and then the cap, not the side, is what makes it usable.
  const wantDown = prefer !== "above";
  const fits = wantDown ? wanted <= roomBelow : wanted <= roomAbove;
  const roomier = wantDown ? roomBelow >= roomAbove : roomAbove >= roomBelow;
  const down = wantDown ? fits || roomier : !(fits || roomier);

  const room = Math.max(minHeight, down ? roomBelow : roomAbove);
  const height = Math.min(wanted, room);

  // Three width modes, because the popups genuinely differ. `true` pins the
  // trigger's width (a select panel narrower than the control it drops from
  // reads as a mistake). `'min'` uses it as a floor and lets a long option grow
  // past it — which is what `min-width: 100%` meant before, and which means
  // nothing once the element is portalled and `100%` refers to <body>. `false`
  // leaves the popup its natural width, for menus hanging off a 44px glyph.
  const floor = matchWidth === "min" ? anchor.width : 0;
  const natural = Math.max(popW, floor);
  const width = matchWidth === true ? anchor.width : Math.min(natural, vp.w - margin * 2);
  const wantLeft = align === "end" ? anchor.right - width : anchor.left;

  return {
    top: down ? anchor.bottom + gap : Math.max(margin, anchor.top - gap - height),
    left: Math.max(margin, Math.min(wantLeft, vp.w - width - margin)),
    width: matchWidth === true ? width : undefined,
    minWidth: matchWidth === "min" ? anchor.width : undefined,
    maxHeight: room,
    down,
  };
}

// useAnchoredPosition — measure `anchorRef`, return a ref for the popup and the
// fixed-position style to spread onto it.
//
//   prefer      'below' | 'above'   which side to try first
//   matchWidth  the popup takes the trigger's width (a select panel should; a
//               menu should not, and would look absurd under a 44px glyph)
//   align       'start' | 'end'     which edge of the trigger to line up with
//   minHeight   never cap smaller than this; below it, flipping is better than
//               a scrollable sliver
export function useAnchoredPosition(open, anchorRef, opts = {}) {
  const {
    prefer = "below",
    matchWidth = false,
    align = "start",
    gap = POPUP_GAP,
    minHeight = 120,
    // `at` anchors to a POINT rather than to an element — where a pointer was when
    // a context menu was asked for. A point is a zero-size rect, so it goes through
    // exactly the same flipping and clamping as an element does; the alternative
    // (a second placement path for menus) is how one of the two ends up off-screen
    // in a corner nobody tested.
    at = null,
  } = opts;
  const popRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }
    const place = () => {
      const a = anchorRef?.current;
      const p = popRef.current;
      if (!p || (!a && !at)) return;
      const r = at
        ? { top: at.y, bottom: at.y, left: at.x, right: at.x, width: 0, height: 0 }
        : a.getBoundingClientRect();
      // scrollHeight, not offsetHeight: once a cap has been applied the
      // element's own height IS the capped one, so re-measuring it would
      // ratchet the popup smaller on every scroll event until it vanished.
      setPos(
        placeAnchored(r, { w: window.innerWidth, h: window.innerHeight }, p.scrollHeight, p.offsetWidth, {
          prefer,
          matchWidth,
          align,
          gap,
          minHeight,
        }),
      );
    };
    place();
    // `true` captures scrolls in any ancestor, not just the window — these
    // triggers live inside scrollable sheets, cards and tables.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anchorRef, prefer, matchWidth, align, gap, minHeight, at?.x, at?.y]);

  const style = {
    position: "fixed",
    top: pos?.top ?? 0,
    left: pos?.left ?? 0,
    right: "auto",
    bottom: "auto",
    maxWidth: `calc(100vw - ${POPUP_MARGIN * 2}px)`,
    // Hidden for the one frame before the measurement exists. Not `display:
    // none` — the element has to be laid out to have a scrollHeight to read.
    visibility: pos ? undefined : "hidden",
    ...(pos?.width ? { width: pos.width } : null),
    ...(pos?.minWidth ? { minWidth: pos.minWidth } : null),
    ...(pos ? { maxHeight: pos.maxHeight } : null),
  };
  return { popRef, pos, style, placedAbove: pos ? !pos.down : false };
}

// useDismiss — close on a click outside every element in `refs`, and on Escape.
//
// It takes a LIST of refs because portalling breaks the usual one-liner: a
// popup rendered into <body> is no longer inside the wrapper, so the familiar
// `wrapper.contains(e.target)` reports every click on the popup as an outside
// click and the menu closes on the way to choosing from it. Every migrated call
// site hit this, so the check lives here once.
export function useDismiss(open, close, refs, opts = {}) {
  // `event` because the call sites do not agree and the difference is real:
  // pointerdown lands before focus moves, mousedown after. A control whose blur
  // handler commits something (TokenInput) was written against pointerdown, and
  // swapping it changes the order those two run in.
  const { onEscape, event = "mousedown" } = opts;
  const events = Array.isArray(event) ? event : [event];
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      for (const ref of refs) if (ref?.current?.contains(e.target)) return;
      close();
    };
    for (const ev of events) document.addEventListener(ev, away);
    return () => {
      for (const ev of events) document.removeEventListener(ev, away);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, close, onEscape, events.join(), ...refs]);
  // ESCAPE IS NOT THIS HOOK'S TO ANSWER ANY MORE — see useEscape. Every popover
  // in the app runs through here, so this one listener was the loudest voice in
  // the seventeen: a popover open inside a panel closed the popover AND the
  // panel, because both heard the same press.
  useEscape(open, () => {
    close();
    onEscape?.();
  });
}

// InfoPopover — the small panel an InfoDot opens. Deliberately NOT the
// full-screen HelpSheet: that is right for a screen's whole glossary and absurd
// for one sentence, which is what an info dot carries.
//
//   pointer  anchored to the dot — below it, flipped above when the bottom of
//            the viewport is closer, always clamped inside the window, with a
//            caret pointing back at the dot it came from (several dots often sit
//            within a few pixels of each other, so "which one was that" is a
//            real question).
//   phone    a compact centred card over a scrim. Centred rather than anchored
//            because a 40px-wide anchor on a 360px screen gives no meaningful
//            direction, and the finger is already covering it.
// `pinned` says a click opened it, so it must not close when the pointer leaves;
// `onHold` / `onLeave` let the card itself keep an UNPINNED popover alive while
// the pointer is inside it (see HOVER_CLOSE_MS).
function InfoPopover({ anchor, title, pinned = true, onHold, onLeave, onClose, children }) {
  const mobile = useIsMobileScreen();
  const cardRef = useRef(null);
  const [pos, setPos] = useState(null);

  // Anchored placement needs the card's real height, which needs one paint —
  // hence useLayoutEffect and the hidden first frame (pos === null).
  useLayoutEffect(() => {
    if (mobile) return undefined;
    const place = () => {
      const el = anchor?.current;
      const card = cardRef.current;
      if (!el || !card) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = card.offsetWidth;
      const h = card.offsetHeight;
      const below = r.bottom + 12 + h <= vh - 10;
      const top = below ? r.bottom + 12 : Math.max(10, r.top - 12 - h);
      const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, vw - w - 12));
      setPos({ top, left, below, caret: Math.max(14, Math.min(r.left + r.width / 2 - left, w - 14)) });
    };
    place();
    // `true` captures scrolls in any ancestor container, not just the window —
    // these dots live inside scrollable cards and sheets.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [mobile, anchor]);

  // ONE OWNER FOR ESCAPE — see useEscape. This popover is mounted only while it
  // is open, so it registers unconditionally.
  useEscape(true, onClose);

  const body = (
    <>
      <p className="info-pop-title">{title}</p>
      <div className="info-pop-body">{children}</div>
    </>
  );

  if (mobile) {
    return createPortal(
      <div className="info-pop-scrim" onMouseDown={onClose} role="presentation">
        <div
          className="info-pop info-pop-centred hand-card hc-r2"
          role="dialog"
          aria-label={title}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {body}
          <button type="button" className="info-pop-close tp-btn tp-btn-ghost tactile" onClick={onClose}>
            {t("common.action.got-it.label")}
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <>
      {/* A transparent catcher rather than a dim scrim: an anchored popover on a
          desktop should not black out the page it is explaining. Only a PINNED
          popover gets one — an unpinned, hover-opened card must not swallow the
          click you were aiming at the page underneath it. */}
      {pinned && <div className="info-pop-catcher" onMouseDown={onClose} role="presentation" />}
      <div
        ref={cardRef}
        className={"info-pop info-pop-anchored hand-card hc-r2" + (pos?.below ? " is-below" : " is-above") }
        role="dialog"
        aria-label={title}
        style={pos ? { top: pos.top, left: pos.left, "--caret-x": `${pos.caret}px` } : { top: 0, left: 0, visibility: "hidden" }}
        // Reaching into the card to read or select must not close it: entering
        // cancels the pending close, leaving restarts it.
        onPointerEnter={onHold}
        onPointerLeave={onLeave}
      >
        {body}
        <span className="info-pop-caret" aria-hidden="true" />
      </div>
    </>,
    document.body,
  );
}

// HOVER_CLOSE_MS — how long an unpinned popover survives the pointer leaving the
// dot. It exists so the pointer can cross the 12px gap into the card: without a
// grace period, reaching for text you want to select closes the thing you were
// reaching for. Entering the card cancels it (see `hold` below).
const HOVER_CLOSE_MS = 140;

// InfoDot — a small circled "i" carrying the explanation a paragraph used to. It
// opens an InfoPopover: anchored beside the dot on a pointer device, a compact
// centred card on a phone.
//
// It carries NO tooltip. It had one — "About ISBN" — and on a phone that was two
// mechanisms answering the same question: hold the dot to be told it explains the
// ISBN, tap it to be told what an ISBN is. The first is a label for a control
// whose entire content is a label. It only confused people, so the dot is now the
// one affordance and the popover is the one answer.
//
// Opening, per input style:
//
//   pointer  hover opens it, and moving away closes it — an explanation should
//            cost a glance, not a click and a dismissal. A CLICK pins it, and a
//            pinned popover stays until it is clicked again (or Escape, or a
//            click outside), because text you want to re-read or copy must not
//            evaporate the moment the mouse drifts.
//   touch    tap toggles. There is no hover to open it with, and nothing to pin
//            against — every touch-opened popover behaves as pinned.
export function InfoDot({ text, title }) {
  const [open, setOpen] = useState(false);
  // pinned = opened (or confirmed) by a click, so the pointer leaving must not
  // close it. Touch always pins, because a tap is the only thing it has.
  const [pinned, setPinned] = useState(false);
  const btn = useRef(null);
  const closeTimer = useRef(null);
  const heading = title || t("common.info.default.title");
  // Named dots announce as "More information: ISBN" — the button's job, not its
  // payload, which a screen reader gets from the popover once it opens. Dots
  // with no title fall back to reading the text, as they always did, because
  // "More information: About this" tells nobody anything.
  const label = title
    ? t("common.info.dot.aria", { name: title })
    : typeof text === "string"
      ? text
      : heading;

  const hold = () => { clearTimeout(closeTimer.current); closeTimer.current = null };
  const shut = () => {
    hold();
    setOpen(false);
    setPinned(false);
    // Drop focus too: a dot left focused inside a scrollable card is a control
    // the next Escape or Enter would re-trigger.
    btn.current?.blur();
  };
  // Leaving closes an unpinned popover after a grace period the card can cancel.
  const leave = () => {
    if (pinned) return;
    hold();
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_MS);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={"info-dot" + (open ? " is-open" : "")}
        aria-label={label}
        aria-expanded={open}
        onPointerEnter={(e) => {
          // Touch fires pointerenter on the tap; that path is the click below.
          if (e.pointerType === "touch") return;
          hold();
          setOpen(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "touch") return;
          leave();
        }}
        onClick={(e) => {
          // Info dots sit inside cards and rows that are themselves clickable;
          // asking for help must never also open the thing behind it.
          e.preventDefault();
          e.stopPropagation();
          // Clicking a hover-opened popover pins it; clicking a pinned one (or a
          // tapped one, which is pinned) closes it.
          //
          // PINNING IS THE POINT AND NOT AN OBSTACLE. This tests `pinned` rather
          // than `open` on purpose: a dot you have clicked is meant to stay
          // until you click it again, so that text you want to re-read or copy
          // does not evaporate when the pointer drifts. Making the click a plain
          // toggle against `open` would take that away — a hover-opened popover
          // would close on the very click that was asking it to stay.
          if (pinned) shut();
          else { hold(); setOpen(true); setPinned(true) }
        }}
        // Keyboard: Escape closes, and the popover's own handler covers that, but
        // a focused dot has to be openable without a pointer at all.
        onFocus={(e) => {
          let keyboard = false;
          try {
            keyboard = !!e.target.matches?.(":focus-visible");
          } catch {
            keyboard = false;
          }
          if (keyboard) { hold(); setOpen(true); setPinned(true) }
        }}
      >
        i
      </button>
      {open && (
        <InfoPopover
          anchor={btn}
          title={heading}
          pinned={pinned}
          onHold={hold}
          onLeave={leave}
          onClose={shut}
        >
          {text}
        </InfoPopover>
      )}
    </>
  );
}

// HelpSheet — the popover an InfoDot or the page Help button opens. Mobile-first:
// a full-screen sheet on a phone (thumb-sized close, room for real prose) and a
// centred dialog on desktop. Portalled to <body> so it escapes the isolated
// stacking context of whatever card it was opened from. Escape and a backdrop
// click both close.
// Kbd — one key cap. The legend everywhere else in this file is built out of
// these, so a shortcut looks the same on a menu row, in the sheet and under a
// quiz card.
//
// A SEQUENCE IS TWO CAPS AND A WORD, not one long cap: "G then L" is two presses
// and drawing it as `Gthen L` would say it is one. shortcutLabel already renders
// the joining word, so the split is on it.
export function Kbd({ keys }) {
  // NOT ON A PHONE. A key cap is an instruction, and an instruction nobody can
  // follow is clutter that also reads as a design that forgot where it was: the
  // drawer's whole job is to list every destination, and printing "G then L"
  // beside each row on a device with no G costs a line of noise on the narrowest
  // screen the app has.
  //
  // The same breakpoint the shell swaps on, deliberately — the drawer, the bottom
  // bar and help.jsx's own choice of which shell to describe all read it, and a
  // second definition of "mobile" is the drift this saves nothing by inviting.
  // A desktop window narrowed past it loses the reminders and keeps the keys.
  //
  // GATED HERE RATHER THAN AT THE CALL SITES, because there are a dozen of them
  // — every drawer row, every quiz button, the MCQ options — and a rule applied
  // to eleven of twelve is the defect this repo keeps finding.
  if (useIsMobileScreen()) return null;
  if (!keys) return null;
  return (
    <span className="kbd-legend" aria-hidden="true">
      {String(keys).split(` ${t("common.kbd.then.label")} `).map((k, i) => (
        <Fragment key={k + i}>
          {i > 0 && <span className="kbd-then">{t("common.kbd.then.label")}</span>}
          <kbd className="kbd">{k}</kbd>
        </Fragment>
      ))}
    </span>
  );
}

// ShortcutSheet — the legend for every binding at once, opened by `?`.
//
// It reads groupedShortcuts() rather than a list of its own, which is the whole
// point: the sheet cannot fall behind the table, and a key added to keys.js
// appears here without anybody remembering to document it. That is the failure
// this replaces — a shortcut legend maintained by hand is a legend that is wrong
// by the second release.
// `omit` is the set of action ids whose row this reader should not be shown —
// the Go-to keys for sections they have hidden. Passed in rather than derived
// here, because this component knows how to draw a key cap and nothing about
// preferences.
export function ShortcutSheet({ open, onClose, omit }) {
  // A sheet whose entire content is keys is nothing on a phone. Refused here as
  // well as hidden at its two entry points, so the one that opens it cannot come
  // back on a screen where every row of it is unreachable — `?` is itself a key,
  // but a Bluetooth keyboard on a narrow window would otherwise open a panel the
  // rest of the app has stopped mentioning.
  if (useIsMobileScreen()) return null;
  if (!open) return null;
  return (
    <HelpSheet open={open} title={t("shell.shortcuts.title")} onClose={onClose}>
      <p className="microcopy" style={{ marginBottom: 14 }}>
        {t("shell.shortcuts.intro.prose")}
      </p>
      <p className="microcopy" style={{ marginBottom: 14 }}>
        {tNodes("shell.shortcuts.practice.prose", {
          mode: <strong>{t("quiz.practice.label")}</strong>,
          key: <kbd className="kbd">{t("vocab.key.shift.label")}</kbd>,
        })}
      </p>
      {groupedShortcuts(omit).map((g) => (
        // Keyed on g.key — the locale key — and not on the words: g.group is now
        // resolved copy, so keying on it would remount every group on a language
        // change.
        <div key={g.key} style={{ marginBottom: 16 }}>
          <MonoLabel className="mb-2 block">{g.group}</MonoLabel>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {g.items.map((it) => (
              <li key={it.id} className="kbd-row">
                <span>{it.label}</span>
                {/* Both forms for a card key, so somebody in Practice is not left
                    pressing one that does nothing. */}
                <span className="kbd-pair">
                  <Kbd keys={it.keys} />
                  {it.practiceKeys && (
                    <>
                      <span className="kbd-then">{t("common.kbd.practice.label")}</span>
                      <Kbd keys={it.practiceKeys} />
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </HelpSheet>
  );
}

export function HelpSheet({ open, title, wide = false, onClose, children }) {
  const mobile = useIsMobileScreen();
  useBodyScrollLock(open);
  // ONE OWNER FOR ESCAPE — see useEscape.
  useEscape(open, () => onClose && onClose());
  if (!open) return null;
  if (mobile) {
    return createPortal(
      <MobileSheet open={open} onClose={onClose} title={title || t("common.help.sheet.title")}>
        <div className="help-sheet-body">{children}</div>
      </MobileSheet>,
      document.body,
    );
  }
  return createPortal(
    <div className={SCRIM_CENTERED} onMouseDown={backdropClose(onClose)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || t("common.help.sheet.title")}
        className="hand-card hc-r2 w-full"
        // The guide needs room for a rail AND a readable measure beside it; the
        // flat list keeps the 520 it was designed at.
        style={{ maxWidth: wide ? 860 : 520, padding: "18px 20px 20px" }}
      >
        <div className="mb-3 flex items-center gap-3">
          <h2 className="display-title flex-1" style={{ fontSize: 'var(--type-ui-19)' }}>
            {title || t("common.help.sheet.title")}
          </h2>
          <IconButton
            icon={<IconClose />}
            ariaLabel={t("common.action.close.label")}
            onClick={onClose}
            style={{ width: 34, height: 34, padding: 0, flexShrink: 0 }}
          />
        </div>
        <div className="help-sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// HelpList — the body of a screen's help: one row per control, glyph + name +
// what it does. Its own component because two things open it — the "?" button on
// most screens, and a ⋯ menu row on the detail screens, whose top bar has no
// room for a sixth 44px control.
// `asset` is the entry's picture, and it is never put beside the term where `icon`
// goes. The two are different jobs: an icon is the glyph the screen uses, so it
// belongs against the name and helps you recognise the row before reading it; an
// asset — a gesture clip, a live control, a diagram — is part of the answer, so it
// belongs where the answer is.
//
// WHERE IN THE ANSWER depends on its shape. A wide asset (a swatch row, the import
// schematic) is drawn under the words, because text beside a 240px picture is a
// ribbon. A gesture CLIP is square and finger-sized, so it is floated into the
// answer and the sentence wraps around it — the clip and the words it explains are
// then one paragraph rather than a caption and a picture.
export function HelpList({ entries = [] }) {
  return (
    <dl className="help-list">
      {entries.map((e) => (
        <HelpRow key={e.term} e={e} />
      ))}
    </dl>
  );
}

// HelpRow — one entry, in the order the eye needs it.
//
//   term      what it is called
//   what      ONE front-loaded sentence. Always visible, and capped by a test.
//   how       up to three verb-first lines. Always visible.
//   asset     the picture, if the answer has one — under the words, EXCEPT a
//             gesture clip, which is floated first so the words wrap around it
//   more      everything else, COLLAPSED
//
// The order is the whole design. People scan rather than read — the F-pattern NN/g
// documented is a warning about that, not a layout to aim at — so the first phrase
// is the answer and anything that is not the answer is one click away rather than
// in front of it.
//
// `more` COLLAPSES RATHER THAN DISAPPEARS. This project writes down why things are
// the way they are, and that writing is worth keeping; what it is not worth is
// being the first thing somebody meets when they wanted to know what a button does.
// A <details> element rather than state of our own: it is keyboard-operable, it is
// findable by the browser's own in-page search even while closed, and it needs no
// hook.
function HelpRow({ e }) {
  const clip = isGestureClip(e.asset);
  return (
    <div className="help-row">
      {e.icon && (
        <span className="help-row-icon" aria-hidden="true">
          {e.icon}
        </span>
      )}
      {/* The words, and — for a clip — the block whose formatting context holds the
          float, so a tall clip on a short entry can never reach the entry below. */}
      <div className="help-row-text">
        {/* FIRST, and only for a clip. A float shortens the line boxes of what
            follows it and nothing else, so an asset left in its old place after the
            words would have nothing left to wrap. `.help-row` is a flex row, and a
            float on a flex item is ignored — which is why the clip floats in here
            with the text rather than beside the icon as a third column. */}
        {clip && <div className="help-row-asset is-clip">{e.asset}</div>}
        <dt>{e.term}</dt>
        <dd>{e.what}</dd>
        {e.how?.length > 0 && (
          <ul className="help-how">
            {e.how.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {e.asset && !clip && <div className="help-row-asset">{e.asset}</div>}
        {e.more && (
          <details className="help-more">
            <summary>{t("common.help.more.label")}</summary>
            <div className="help-more-body">{e.more}</div>
          </details>
        )}
      </div>
    </div>
  );
}

// HelpRail — the list of sections, and the reason the panel is navigable at all.
//
// A rail rather than a search box, and rather than an accordion: 157 entries is a
// document you scan for the heading you want, and the ask was "know where to go at
// a glance, get there with a click or a short scroll". A search box answers only
// when you already know the word for the thing you cannot find, which is not the
// state somebody opening help is in.
//
// It is a column on a desktop and a scrolling row of pills on a phone, which is the
// same swap the shell makes between a tab strip and a bottom bar. Plain anchors, so
// the browser does the scrolling and the back button undoes it.
function HelpRail({ sections, active, railRef }) {
  // TWO SHAPES, ONE RAIL. On a desk it is a sticky column capped at 62vh; on a
  // phone the media query turns it on its side into a strip. `both` covers each
  // without asking which one is on screen — only the axis that actually overflows
  // ever wears a fade.
  useEdgeScroll(railRef, { axis: "both" });
  return (
    <nav className="help-rail" aria-label={t("common.help.rail.aria")} ref={railRef}>
      {sections.map((sec) => (
        <a
          key={sec.id}
          href={`#help-${sec.id}`}
          className={"help-rail-item" + (sec.id === active ? " is-active" : "")}
          aria-current={sec.id === active ? "true" : undefined}
        >
          {sec.title}
        </a>
      ))}
    </nav>
  );
}

// HelpGuide — the whole panel: a rail, then every section with an anchor.
//
// `active` is the section the reader was on when they pressed "?", and it is
// scrolled to on open rather than being the only thing shown. That is the
// difference the owner asked for: help is still contextual — it opens where you
// are — but the rest of it is now one click away instead of behind a different
// screen's "?" button.
export function HelpGuide({ sections = [], active }) {
  const bodyRef = useRef(null);
  const railRef = useRef(null);
  const mobile = useIsMobileScreen();
  // TWO BEHAVIOURS, because the two layouts have different scroll containers and
  // the phone one cannot afford to scroll past its own map.
  //
  // On a POINTER screen the guide body scrolls inside a fixed panel, the rail is
  // sticky beside it, and jumping to the section you came from costs nothing — the
  // map stays on screen the whole time.
  //
  // On a PHONE the sheet itself scrolls, so the same jump carried the rail off the
  // top and left the reader in the middle of a document with no visible way out.
  // Making the rail sticky there fixed that and broke two other things (prose
  // leaking above it, the section heading clipped under it). So the phone does not
  // scroll at all: the whole rail is the first thing on screen, and the section you
  // came from is the pill that is marked — scrolled into view HORIZONTALLY, which
  // is the one bit of scrolling that helps rather than hides.
  //
  // `instant` on purpose in both: an animated jump on open reads as the panel being
  // unable to decide where it is.
  useEffect(() => {
    if (!active) return;
    if (mobile) {
      railRef.current
        ?.querySelector(".help-rail-item.is-active")
        ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" });
      return;
    }
    const el = bodyRef.current?.querySelector(`#help-${active}`);
    el?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [active, sections, mobile]);
  return (
    <div className="help-guide">
      <HelpRail sections={sections} active={active} railRef={railRef} />
      <div className="help-guide-body" ref={bodyRef}>
        {sections.map((sec) => (
          <section key={sec.id} id={`help-${sec.id}`} className="help-section">
            <h3 className="help-section-title">{sec.title}</h3>
            <HelpList entries={sec.entries} />
          </section>
        ))}
      </div>
    </div>
  );
}

// HelpButton — the "?" the shell's top bar carries (§ declutter). It opens the
// current screen's own glossary: every control on it, named and explained, so the
// layout itself needs no standing explanatory prose. `entries` is
// [{ term, what, icon? }]; `title` names the screen.
//
// `variant` picks the skin. "pill" is the desktop top bar's, matching the Search
// button beside it exactly — same accent texture, same 38px round pill — because
// the two sit side by side as peers and a bordered 44px disc between Search and
// the avatar read as a control from a different set. The default ring is for the
// two places the bar is not on screen: the work-detail ⋯ menu and the full-screen
// Profile page.
export function HelpButton({ title, entries = [], sections = null, active, side = "bottom", variant = "ring" }) {
  const [open, setOpen] = useState(false);
  // `sections` is the navigable guide; `entries` is the flat list. Both are
  // supported because two callers want each: the shell's "?" opens the guide, and a
  // work-detail ⋯ row opens that screen's list on its own.
  if (!sections && !entries.length) return null;
  const pill = variant === "pill";
  return (
    <>
      <Tooltip label={t("common.help.button.tip", { name: title })} side={side} className={open ? "is-open" : ""}>
        <button
          type="button"
          className={
            (pill ? "topbar-add-btn tactile icon-only" : "help-btn tactile") + (open ? " is-open" : "")
          }
          aria-label={t("common.help.button.aria", { name: title })}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <IconHelp size={pill ? 18 : 22} />
        </button>
      </Tooltip>
      <HelpSheet open={open} title={title} wide={!!sections} onClose={() => setOpen(false)}>
        {sections ? <HelpGuide sections={sections} active={active} /> : <HelpList entries={entries} />}
      </HelpSheet>
    </>
  );
}

// InlineField — read-at-rest, edit-in-place. The house pattern for every field
// that used to sit in a modal behind an "Edit" button and save with a "Save"
// one: the value reads as plain text with a pencil beside it, the pencil swaps
// it for an input with ✓ / ✕ discs, and ✓ saves that one field. `render` draws
// the resting value (defaults to the text); `input` draws the editor, given
// { value, onChange } — so a token list or a textarea drops straight in.
export function InlineField({
  label,
  value = "",
  // `source` is the supplier slug that last wrote this field and `sourceAt` when —
  // both straight off the record's `field_sources`. Absent means the field has no
  // row there, which is "we do not know" rather than "nobody has touched it", and
  // draws nothing at all.
  source,
  sourceAt,
  // `sourceOpen` makes the provenance tag a door — the field's candidates, with
  // what each supplier is offering. Absent on most rows, and then the tag is the
  // label it has always been. See fieldOffers.jsx.
  sourceOpen,
  display,
  placeholder,
  hint,
  multiline = false,
  inputMode,
  maxLength,
  input,
  onSave,
  busy = false,
  disabled = false,
  editLabel,
  nameCase = false,
  // fieldKey opts this row into its panel's master save. Absent — which is every
  // row outside the Details panel — and the row behaves exactly as it always
  // has: it saves itself and nothing collects it.
  fieldKey,
  // `half` asks to share its line with the next row like it. Honoured only
  // inside `.inline-field-rows` — a row on its own is always full width, so the
  // flag costs nothing where nobody paired it.
  half = false,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // The row saves the string you can see: nothing rewrites the draft, and
  // `nameCase` only asks the keyboard for a capital per word (see below).
  const setTyped = setDraft;
  const ref = useRef(null);
  // A save elsewhere (adopting a lookup match) must be reflected at rest.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  // commit waits for the save before closing the editor. Closing first would be
  // snappier and would also throw away what you typed the moment the request
  // failed — the row would snap back to the old value with the new one gone.
  // `onSave` returning false (or throwing) keeps the editor open, text intact,
  // beside whatever error the caller rendered.
  async function commit() {
    if (draft === value) return setEditing(false);
    try {
      const ok = await onSave?.(draft);
      if (ok !== false) setEditing(false);
    } catch {
      // stay open — the caller shows the error
    }
  }
  function cancel() {
    setDraft(value);
    setEditing(false);
  }
  // Enter saves a plain one-line field. It must NOT save when the caller
  // supplied its own editor: in a TokenInput, Enter is how you add a token, and
  // committing on it would close the row the moment you typed your first genre.
  // Escape always backs out, whatever the editor.
  const enterCommits = !multiline && !input;
  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "Enter" && enterCommits) {
      e.preventDefault();
      commit();
    }
  };

  // ---- the master save's half of the bargain --------------------------------
  // Registered on the DIRTY FLIP rather than on the draft, so typing does not
  // churn the host's state; the draft is handed over as a getter and read at
  // save time. An open row you have not changed is not unsaved work, so it does
  // not register — pressing ✓ with three rows merely open must do nothing.
  const host = useContext(UnsavedFieldsContext);
  const fieldId = useId();
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const dirty = editing && draft !== value;
  useEffect(() => {
    if (!host?.register || !fieldKey || !dirty) return;
    host.register(fieldId, {
      key: fieldKey,
      label,
      get: () => draftRef.current,
      close: () => setEditing(false),
    });
    // Unregisters when the row goes clean, closes, or unmounts — the last one
    // matters, because a panel switching to the metadata picker must not leave
    // a save behind for fields that are no longer on screen.
    return () => host.register(fieldId, null);
  }, [host, fieldKey, dirty, fieldId, label]);

  const filled = Array.isArray(value) ? value.length > 0 : String(value ?? "").trim() !== "";
  return (
    <div className={"inline-field" + (half ? " is-half" : "")}>
      <div className="inline-field-head">
        <MonoLabel>{label}</MonoLabel>
        {hint && <InfoDot text={hint} title={label} />}
        <span className="flex-1" />
        {/* WHO WROTE THIS FIELD, on the field's own row and nowhere else. It sits
            before the pencil, and only at rest: while you are editing, the row's
            right-hand end belongs to ✓ and ✕, and a provenance tag that survived
            into the editor would be reporting on a value you have already left. */}
        {!editing && source ? <FieldSourceTag source={source} at={sourceAt} onOpen={sourceOpen} disabled={busy || disabled} /> : null}
        {!editing && !disabled && (
          <FieldIconButton
            icon={<IconEdit />}
            ariaLabel={editLabel || t("common.action.edit.field.aria", { field: String(label).toLowerCase() })}
            onClick={() => setEditing(true)}
          />
        )}
        {editing && (
          <>
            <FieldIconButton
              icon={<IconCheck />}
              ariaLabel={t("common.action.save.field.aria", { field: String(label).toLowerCase() })}
              disabled={busy}
              onClick={commit}
              tooltip={t("common.action.save.label")}
              ok
            />
            <FieldIconButton
              icon={<IconClose />}
              ariaLabel={t("common.action.cancel.label")}
              disabled={busy}
              onClick={cancel}
            />
          </>
        )}
      </div>
      {editing ? (
        <div onKeyDown={onKey}>
          {input ? (
            input({ value: draft, onChange: setDraft, ref })
          ) : multiline ? (
            // The row's name is drawn as a MonoLabel beside the pencil, which is
            // a heading for the row rather than a <label> for this box — so
            // until 1.14.2 the editor a screen reader landed in announced
            // nothing at all. Named here rather than by wiring the MonoLabel up,
            // because that label belongs to the whole row, ✓ and ✕ included.
            <textarea
              ref={ref}
              className="tp-input"
              rows={4}
              value={draft}
              aria-label={label}
              onChange={(e) => setTyped(e.target.value)}
            />
          ) : (
            <input
              ref={ref}
              className="tp-input"
              value={draft}
              inputMode={inputMode}
              maxLength={maxLength}
              autoComplete="off"
              // A name asks the keyboard for a capital per word; prose keeps the
              // browser default. See "name casing".
              autoCapitalize={nameCase ? "words" : undefined}
              aria-label={label}
              onChange={(e) => setTyped(e.target.value)}
            />
          )}
        </div>
      ) : (
        <div className={"inline-field-value" + (filled ? "" : " is-empty")}>
          {filled ? display || String(value) : placeholder || t("common.field.inline.placeholder")}
        </div>
      )}
    </div>
  );
}

// BigField — a Details row whose editor is a SHEET rather than the row itself.
//
// FOUR FIELDS KEEP THEIR PANEL, and the handoff names each one's reason so that
// nobody adds a fifth by feel: a description is prose and editing it in a 44px
// row means reading it through a letterbox; genres are a token input with a
// filter list of their own; a cover is a grid of pictures with no text to type;
// people are not a value at all but a list of rows with roles and their own
// actions. Everything else edits where it stands.
//
// THE AFFORDANCE IS ONE AFFORDANCE. This is InlineField's resting row, to the
// pixel — same label, same provenance tag, same pencil in the same place — and
// only what the pencil OPENS differs. A reader is not being asked to learn which
// rows are cheap; the size of the thing decides where it opens and says nothing
// about it beforehand.
export function BigField({ label, display, placeholder, hint, source, sourceAt, sourceOpen, onOpen, disabled = false, editLabel, half = false }) {
  const filled = display != null && display !== "" && !(Array.isArray(display) && display.length === 0);
  return (
    <div className={"inline-field" + (half ? " is-half" : "")}>
      <div className="inline-field-head">
        <MonoLabel>{label}</MonoLabel>
        {hint && <InfoDot text={hint} title={label} />}
        <span className="flex-1" />
        {source ? <FieldSourceTag source={source} at={sourceAt} onOpen={sourceOpen} disabled={disabled} /> : null}
        {!disabled && (
          <FieldIconButton
            icon={<IconEdit />}
            ariaLabel={editLabel || t("common.action.edit.field.aria", { field: String(label).toLowerCase() })}
            onClick={onOpen}
          />
        )}
      </div>
      <div className={"inline-field-value" + (filled ? "" : " is-empty")}>
        {filled ? display : placeholder || t("common.field.inline.placeholder")}
      </div>
    </div>
  );
}

// ---- spaced-repetition status dot (v0.5.0) ----

// STATUS_META — the three repetition statuses (renamed for clarity) plus the
// unseen state, each with its dot colour. Mirrors recallStatus() on the server.
// `label` holds a key, resolved where the dot is drawn.
export const STATUS_META = {
  remembered: { label: "common.status.remembered.label", color: "var(--ok)", filled: true },
  forgetting: { label: "common.status.forgetting.label", color: "var(--amber)", filled: true },
  "probably-forgotten": { label: "common.status.probably-forgotten.label", color: "var(--error)", filled: true },
  unseen: { label: "common.status.unseen.label", color: "var(--faint)", filled: false },
};

// fmtHalfLife renders a memory half-life (days) compactly: hours under a day,
// then days, weeks, months. (Also used by the Stats page Memory card.)
export function fmtHalfLife(h) {
  if (h < 1) return t("common.half-life.hours.label", { n: Math.max(1, Math.round(h * 24)) });
  if (h < 14) return t("common.half-life.days.label", { n: Math.round(h) });
  if (h < 60) return t("common.half-life.weeks.label", { n: Math.round(h / 7) });
  return t("common.half-life.months.label", { n: Math.round(h / 30) });
}

// Server constants mirrored from internal/httpapi/review_handlers.go: the
// half-life floor (reviewMinStability) and the new-item grace week
// (reviewNewItemDays) — keep the two in lockstep.
const MIN_HALF_LIFE = 7;
const NEW_ITEM_DAYS = 7;

// utcDays — days elapsed since a stored UTC "YYYY-MM-DD HH:MM:SS" timestamp
// (normalised to an ISO instant); NaN input yields the fallback.
function utcDays(ts, fallback) {
  if (!ts) return fallback;
  const ms = Date.parse(String(ts).replace(" ", "T") + "Z");
  return Number.isNaN(ms) ? fallback : (Date.now() - ms) / 86400000;
}

// reviewStatus derives a quote's repetition status from the fields the list
// endpoints attach (reviewed / stability / last_reviewed_at / last_result /
// created_at). It mirrors the server's forgetting-curve model
// p = 2^(-elapsed/half-life): remembered at p >= 0.9, forgetting down to 0.5,
// probably-forgotten below. A card whose last answer was a lapse ("forgot")
// is always probably-forgotten, however recently reviewed — the failed
// recall, not the timestamp, is the honest signal (mirrors recallStatus on
// the server). A quote inside its first week (created_at) reads remembered —
// you just wrote it down. The tooltip carries the half-life and when it next
// comes due, like the settings InfoDots.
export function reviewStatus(item = {}) {
  const { reviewed, stability, last_reviewed_at, last_result, created_at } = item;
  // New-item grace week (mirrors the server): remembered before any review,
  // and not yet in the Daily Quiz — unless a recorded lapse says otherwise.
  if (last_result !== "forgot" && utcDays(created_at, Infinity) < NEW_ITEM_DAYS) {
    const meta = STATUS_META.remembered;
    return {
      key: "remembered",
      ...meta,
      tip: t("common.status.tip", { name: t(meta.label), detail: t("common.status.new.detail") }),
    };
  }
  if (!reviewed) return { key: "unseen", ...STATUS_META.unseen, tip: t(STATUS_META.unseen.label) };
  const h = Math.max(Number(stability) || MIN_HALF_LIFE, MIN_HALF_LIFE);
  const elapsed = utcDays(last_reviewed_at, 0);
  const p = Math.pow(2, -elapsed / h);
  const key =
    last_result === "forgot"
      ? "probably-forgotten"
      : p >= 0.9
        ? "remembered"
        : p >= 0.5
          ? "forgetting"
          : "probably-forgotten";
  const meta = STATUS_META[key];
  // Five words is the house ceiling for a label, so the dot names the state
  // and the ONE number that matters at that moment: how long it keeps if it is
  // holding, or that it is already owed a look if it is not.
  const due =
    elapsed >= h
      ? t("common.status.due.detail")
      : t("common.status.half-life.detail", { span: fmtHalfLife(h) });
  return { key, ...meta, tip: t("common.status.tip", { name: t(meta.label), detail: due }) };
}

// ReviewDot — the coloured repetition-status dot shown on every quote/dialogue
// card. Hover/focus reveals the status + half-life (a Tooltip, same as InfoDot).
export function ReviewDot({ item, side = "top" }) {
  const st = reviewStatus(item);
  return (
    <Tooltip label={st.tip} side={side}>
      <span
        tabIndex={0}
        className="status-dot"
        aria-label={st.tip}
        style={{
          background: st.filled ? st.color : "transparent",
          // Always ring in the status colour (unseen = a visible hollow grey);
          // using --line here made the unseen dot invisible against the card.
          borderColor: st.color,
        }}
      />
    </Tooltip>
  );
}

// ---- "the quiz will not ask about this" (0033) ----

// skipReason — why the Daily Quiz will not draw this row, or "" when it will.
//
// ONE FLAG DECIDES, and the second one only explains. The deck's eligibility
// rule (reviewSource.where, server-side) reads the quote's OWN column and
// nothing else; excluding a work writes that column across its quotes and seeds
// the ones added later, so a skipped book still reaches its highlights — as a
// write you can see on the card rather than as a term in a query.
//
// It used to read `own || work`, which was right while the deck ANDed both. It
// is wrong now in a state that is reachable on purpose: put ONE highlight of a
// skipped book back in the quiz and its own flag is clear while its book's is
// still set. The deck will serve that card. A mark saying otherwise would be the
// same lie the old "back in the quiz" toast told, drawn instead of spoken.
//
// The work's flag still shapes the WORDING, because "skipped with its book" and
// "skipped on its own" are undone in different places — and the second sentence
// is also what warns you that the next highlight you save here starts excluded.
//
// `parent` is the word for what the work is on this screen — "book", "film",
// "show". The caller knows it; the row does not carry media_type, and inferring
// "film" from a movie_id would be wrong on every episode of a series.
export function skipReason(item = {}, parent = "") {
  if (!item.review_excluded) return "";
  // ONE field for both kinds, and the server's parity test is what settled it.
  // Spelled book_review_excluded / movie_review_excluded it read exactly like
  // book_title beside movie_title — but then this line is `book_x || movie_x`,
  // and dropping one of the two is a mark that is right on books and silently
  // absent on films, on a screen where nothing looks wrong either way.
  if (item.work_review_excluded) return t("common.quiz-skip.with-work.label", { kind: parent || t("unit.work.one") });
  return t("common.quiz-skip.alone.label");
}

// QuizSkipMark — the struck flash card, on any row the quiz will not draw.
//
// THE SAME GLYPH THE BUTTON WEARS. IconQuizSkip is what "Skip in quiz" is drawn
// as in the selection bar and the card menu, so the mark on the card is the
// picture of the act that put it there. A second drawing for the state would be
// the Share/Upload mistake again — two glyphs a pixel apart meaning one thing.
//
// `quiet` DROPS THE TOOLTIP AND THE FOCUS STOP, for a mark that sits inside a
// button — a work tile, a search hit. Two reasons, and either alone is enough:
// a focusable element inside a <button> is invalid HTML and the browsers
// disagree about which control a tap belongs to; and Tooltip binds its own
// long-press, which would swallow the tile's long-press-to-select on exactly
// the corner the mark occupies. The aria-label stays either way, so the mark is
// never silent to a screen reader — it just folds into the button's name
// instead of standing beside it.
export function QuizSkipMark({ item, parent = "", side = "top", quiet = false }) {
  const why = skipReason(item, parent);
  if (!why) return null;
  const mark = (
    <span
      className="quiz-skip-mark"
      aria-label={why}
      tabIndex={quiet ? undefined : 0}
      role={quiet ? "img" : undefined}
    >
      <IconQuizSkip size={13} />
    </span>
  );
  return quiet ? mark : <Tooltip label={why} side={side}>{mark}</Tooltip>;
}

// ---- placeholders & film-strip pieces (§6) ----

// Placeholder — diagonal stripes + mono COVER/POSTER label, 2:3.
export function Placeholder({ kind, className = "", style }) {
  return (
    <span className={"ph " + className} aria-hidden="true" style={style}>
      <span className="mono-label ph-label">{kind === undefined ? t("common.badge.cover") : kind}</span>
    </span>
  );
}
// g-poster is the glossary page's own sizing class, not the app's — the demo has to
// stand at poster proportions to show what the hatch looks like at the size it is used.
if (import.meta.env.DEV) {
  Placeholder.glossary = { demo: (h) => h(Placeholder, { className: "g-poster" }) };
}

export function Sprockets({ count = 9 }) {
  return (
    <div className="sprockets" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}

export function EdgeRow({ left, code }) {
  return (
    <div className="edge-row" aria-hidden="true">
      <span>{left || t("common.filmstrip.edge.label")}</span>
      {code != null && (
        <span className="inline-flex items-center gap-1">
          {code}
          <IconArrow size={12} />
        </span>
      )}
    </div>
  );
}

export function FrameCode({ children }) {
  return (
    <span className="frame-code" aria-hidden="true">
      {children}
    </span>
  );
}

// Frame codes are runtime-random, memoised per mount (§6):
// base = 11 + floor(random()*28); frames render `${base+i}A`.
export function useFrameBase() {
  return useMemo(() => 11 + Math.floor(Math.random() * 28), []);
}
export const frameCode = (base, i = 0) => `${base + i}A`;

// ---- shared class names ----
//
// What is left of the pre-redesign compatibility block. Six of its eight
// constants (inputClass, buttonClass, ghostButtonClass, cardClass,
// linkButtonClass, deleteButtonClass) had no caller anywhere once the page pass
// finished, and an exported name for a button style is exactly the kind of
// thing a later screen adopts by accident, giving one control two vocabularies.
// These two have real callers, both in this file, so neither is exported.

const chipClass = "tp-chip";
// Derived from the slot list rather than written out, so a colour added by a
// migration cannot arrive with no dot class and render as an unstyled circle.
// The class names follow the tokens by construction; index.css declares one
// .dot-<token> per slot.
const colorDotClass = Object.fromEntries(CATEGORY_SLOTS.map((tok) => [tok, "dot-" + tok]));

// splitCommas turns a comma-separated input value into a trimmed string array.
export function splitCommas(s) {
  return String(s)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

// normName folds a name for fuzzy comparison: lowercased, diacritics stripped,
// punctuation collapsed to spaces. "Fyodor Dostoyevsky" and "Fyodor Dostoevsky"
// stay one edit apart; "J.R.R. Tolkien" and "JRR Tolkien" normalise equal.
// NOTE the [^a-z0-9] class is Latin-only: a Bengali, Cyrillic or CJK string
// folds to "". Callers that use this as a grouping key MUST treat "" as
// "cannot compare" rather than as a shared key, or every non-Latin record
// collapses into one bucket.
export function normName(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// titleCaseGenre normalizes a genre's casing: Title Case each word, EXCEPT a
// token that arrives all-caps (an acronym like "YA" / "SFF" / "LGBTQ"), which is
// left untouched. "fantasy" -> "Fantasy", "science fiction" -> "Science Fiction",
// "YA" -> "YA".
export function titleCaseGenre(s) {
  const str = String(s).trim();
  const letters = str.replace(/[^\p{L}]/gu, "");
  if (letters && letters === letters.toUpperCase()) return str; // keep acronyms / all-caps
  return str.replace(
    /\S+/g,
    (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
  );
}

// ---- name casing: the keyboard's job, not ours (2.2.8) ----------------------
//
// THERE ARE TWO THINGS THAT CAN CAPITALISE A TEXT FIELD ON A PHONE, and for six
// releases this app used the wrong one.
//
//   1. THE KEYBOARD, TOLD WHAT TO DO BY THE PAGE. The HTML `autocapitalize`
//      attribute takes `off`/`none`, `sentences` (the browser default for a text
//      input), `words` or `characters`, and the on-screen keyboard obeys it. That
//      is why one app capitalises after a full stop and the next one does not on
//      the same keyboard: the app said so. It is a hint about the SOFTWARE
//      keyboard only - it does nothing to a hardware keyboard and nothing at all
//      on a desktop.
//
//   2. A TRANSFORM IN THE PAGE, rewriting the value on every keystroke. That is
//      what used to live here: two rules, a small-word list, a clause-end regex, a
//      last-word scan, and an escape hatch that went `free` when you re-cased a
//      letter by hand.
//
// (2) IS GONE, AND THE REASON IS THAT IT COULD NOT BE ARGUED WITH. "The Wheel of
// Time" was the title it was written for and the title it kept failing on - three
// releases, three fixes, and the reader still could not type it. That is the shape
// of a rule that has to guess: every guess needs an escape hatch, every hatch
// needs to be discovered, and a reader who has not read this file has no way to
// know either exists. Meanwhile it rewrote what a provider had spelled correctly,
// it disagreed with the phone's own keyboard underneath it, and on a laptop it was
// the only thing capitalising at all.
//
// WHAT REPLACES IT IS ONE ATTRIBUTE: `autocapitalize="words"` on the fields that
// hold a name or a title. The phone offers a capital at the start of every word,
// which is right nearly always - and when it is wrong the reader presses shift,
// which is a control they already know, works on the field they are looking at,
// and needs no hatch. On a desktop nothing capitalises anything and what you type
// is what is stored, which is what a keyboard is for.
//
// SO THE FIELD STILL SAYS WHICH IT IS: `nameCase` marks a box holding a person, a
// title, a series or a character, and it now sets the hint instead of running a
// rule. Ordinary prose - a quote, a note - leaves the attribute off and keeps the
// browser's `sentences` default, which is exactly right there.
//
// ONE FLAG, NOT TWO. `titleCase` existed to pick the small-word rule over the
// person rule, and with no rule left to pick there is nothing for a second flag to
// say. Keeping it would have been a prop that changed nothing, which is worse than
// the rename.
//
// The one transform that survives is titleCaseGenre, and it survives because it is
// not this: a genre is a word from a closed vocabulary, normalised on COMMIT
// rather than per keystroke, so it never fights the person typing.

export function ErrorText({ children }) {
  if (!children) return null;
  return <p className="tp-error">{children}</p>;
}

export function EmptyState({ children }) {
  return <p className="tp-empty">{children}</p>;
}

export function Chips({ items, className = "" }) {
  if (!items || items.length === 0) return null;
  return (
    <span className={"flex flex-wrap gap-1 " + className}>
      {items.map((g) => (
        <span key={g} className={chipClass}>
          {g}
        </span>
      ))}
    </span>
  );
}

// Lightbox — a full-screen viewer for a stored cover/poster. Closes on the ×
// button, Escape, a backdrop tap, and the browser/Android back gesture (it
// pushes a history entry on open and closes when that entry is popped).
export function Lightbox({ path, title, onClose }) {
  // This viewer is where the Back-closes-the-overlay behaviour was written, and
  // it is the hook's own body verbatim — so it uses the hook now, and every other
  // overlay in the app inherits what only the Lightbox used to have.
  useBackToClose(true, onClose);
  // ONE OWNER FOR ESCAPE — see useEscape. Mounted only while open, so it
  // registers unconditionally; it is the deepest thing on screen when it is up,
  // and it is now the only thing Escape reaches.
  useEscape(true, onClose);
  // Portal to <body>: the detail hero has a filter/will-change ancestor, which
  // makes position:fixed anchor to it instead of the viewport — so a plain
  // render would trap the overlay inside the cover's box. The portal escapes it.
  return createPortal(
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={title ? t("common.cover.alt", { title }) : t("common.cover.lightbox.untitled.aria")}
      onClick={onClose}
    >
      {/* The shared cross, not a hand-rolled one. This drew its own at
          strokeWidth 2 against the set's 1.85 — the same divergence the nav had,
          in the one control that sits over a full-bleed image where a heavier
          stroke is least noticeable and least excusable. */}
      <button type="button" className="lightbox-close" aria-label={t("common.action.close.label")} onClick={onClose}>
        <IconClose />
      </button>
      <img
        src={coverImgURL(path)}
        alt={title ? t("common.cover.alt", { title }) : ""}
        className="lightbox-img"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}

// ---- the media block: a picture, its true size, and the verbs that change it ----

// THE ONE COVER FLOOR. Both halves of the app read this number and it answers
// exactly one question: WILL FETCH REPLACE THIS PICTURE WITH A BIGGER ONE?
//
// The server answers that in `lowResCoverWidth` (internal/httpapi/metadata_handlers.go)
// and it answers it on WIDTH ALONE — a refetch swaps stored art only for a wider
// image, and the `low_res_cover` gap Metadata counts is the same test. So the red
// ink here has to be that test too, or the block calls a cover unusable and the one
// button offered to repair it declines. The design pack asked for 400x600; the
// height half would ink a 600x500 cover red with nothing on the server willing to
// change it, which is a promise the app cannot keep, and the 400 would leave a
// 450-wide cover un-inked here while Metadata lists it as a gap. One number, one
// question. `cover-floor.test.js` pins it to the Go constant so they cannot drift.
export const COVER_MIN_W = 500;

// A FACE IS A DIFFERENT QUESTION, and nothing on the server acts on it: portraits
// have no refetch threshold, so this is the pack's own floor and answers only
// "is there enough picture here to crop". Read as a MINIMUM SIDE rather than a
// width, because a round crop takes the shorter one.
export const PORTRAIT_MIN_SIDE = 400;

// mediaLow — is this picture under its floor? A rectangle is judged on width (see
// COVER_MIN_W); a circle on its shorter side, because that is what the crop keeps.
// A missing picture is 0x0, which is under every floor, and deliberately so: it is
// not usable either, and saying so in the same ink is one rule rather than two.
export function mediaLow(dim, floor, shape) {
  if (!dim) return false;
  return (shape === "round" ? Math.min(dim.w, dim.h) : dim.w) < floor;
}

// MediaBlock — one picture, stated at its true size, with the verbs that change
// it, drawn as a single object rather than a thumbnail beside a toolbar.
//
// WHY THE SIZE IS MEASURED AND NOT ASKED FOR. `naturalWidth`/`naturalHeight` are
// the dimensions of the bytes the browser actually loaded, which are the stored
// file's: /covers/{name} is an `http.ServeFile` of it (covers_handler.go) and no
// resizing sits in front. The day that route learns a `?w=` variant this line
// becomes a confident lie — and it is the exact number a reader uses to decide
// whether to replace their cover, so that change has to bring a real size with it.
//
// WHY `verbs` ARE NODES AND NOT DESCRIPTORS. Upload is a <label> wrapping a hidden
// file input, not a button; no descriptor shape holds all four without a special
// case for it. The grid enforces the two columns and the 36px minimum instead, so
// the block still reads as one object whatever the caller hands it.
export function MediaBlock({
  shape = "rect",
  src,
  alt = "",
  // Whose face this is, when it is a face: the placeholder is one of six and the
  // name is what picks it (silhouette.jsx). A round block with no name still
  // draws a silhouette — it just draws the same one every time, which is what
  // the app did everywhere before §1.8.
  name = "",
  label = "",
  floor = COVER_MIN_W,
  verbs = [],
  blocked = null,
  children,
  className = "",
}) {
  const [dim, setDim] = useState(null);
  const [broke, setBroke] = useState(false);
  const round = shape === "round";
  // A NEW PICTURE IS NOT THE OLD ONE'S SIZE. Both bits of measured state belong
  // to whatever `src` currently is, so both are dropped when it changes —
  // otherwise pasting a second URL states the first one's pixels, and one bad
  // URL leaves the block stuck on "blocked" for every good one after it.
  useEffect(() => {
    setDim(null);
    setBroke(false);
  }, [src]);

  // THREE STATES, AND ONLY ONE OF THEM IS RED.
  //   no picture at all  -> 0x0 px, under every floor, and inked: it is not
  //                         usable either, which is one rule rather than two.
  //   loading, or failed -> no line. A picture the page could not DRAW (a
  //                         pasted URL from a host the CSP will not allow) has
  //                         a perfectly good size that this page cannot read,
  //                         and "0x0 px" in red would be a plain lie about it.
  //   drawn              -> what it actually measured.
  const has = !!src && !broke;
  const size = !src ? { w: 0, h: 0 } : broke ? null : dim;
  const low = mediaLow(size, floor, shape);

  const pic = has ? (
    <img
      src={src}
      alt={alt}
      onLoad={(e) => setDim({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
      onError={() => setBroke(true)}
    />
  ) : broke && blocked ? (
    blocked
  ) : round ? (
    // The pack's rule: a silhouette for a missing face, the hatch for everything
    // else. They are not interchangeable — a hatched circle reads as a broken
    // image where a silhouette reads as a person nobody has photographed yet.
    <span className="tp-media-face" aria-hidden="true"><Silhouette name={name || alt} /></span>
  ) : (
    <Placeholder kind={label || t("common.badge.cover")} />
  );

  return (
    <div className={("tp-media " + className).trim()}>
      <div className="tp-media-pic-col">
        <span className={"tp-media-pic" + (round ? " is-round" : "")}>{pic}</span>
        {size && (
          // The line is inked, and colour alone is not a message — so the reason
          // is also the line's accessible name. Three of them, because "under
          // 500px wide" is wrong for a circle and wrong again for no picture.
          <Tooltip label={!has ? t("media.dims.none.tip") : !low ? t("media.dims.tip") : t(round ? "media.dims.low.side.tip" : "media.dims.low.tip", { floor })}>
            <span className={"tp-media-dims" + (low ? " is-low" : "")}>
              {t("media.dims", { w: size.w, h: size.h })}
            </span>
          </Tooltip>
        )}
      </div>
      <div className="tp-media-side">
        {label && <MonoLabel className="block">{label}</MonoLabel>}
        {verbs.length > 0 && (
          <div className="tp-media-verbs">
            {/* Index keys: a caller's verb list is written out longhand and never
                reordered, and the nodes carry no keys of their own. */}
            {verbs.map((v, i) => (
              <span className="tp-media-verb" key={i}>{v}</span>
            ))}
          </div>
        )}
      </div>
      {/* Children.toArray drops the false branches of a caller's conditionals,
          which is the difference between "there is a drawer open" and "there are
          four things that are not open" — the latter would still lay out a row
          and its gap. */}
      {Children.toArray(children).length > 0 && <div className="tp-media-extra">{children}</div>}
    </div>
  );
}

// Both shapes, because only the rectangle has a caller in the app today — the
// portrait half lands with the person panel, and until then this page is where
// it is seen at all.
if (import.meta.env.DEV) {
  MediaBlock.glossary = {
    demo: (h) => {
      // The real four, in the real order, drawn with the real glyphs: a page
      // that documents the 2x2 with stand-in characters documents a 2x2 that
      // does not exist anywhere.
      const verbs = [
        [IconMetadata, "Fetch"],
        [IconSearch, "Search"],
        [IconUpload, "Upload"],
        [IconLink, "Paste URL"],
      ].map(([Icon, name]) =>
        h(
          "button",
          { type: "button", className: "field-icon-btn field-icon-btn-boxed tactile", "aria-label": name },
          h(Icon, null),
        ),
      );
      return h("div", { style: { display: "grid", gap: 14 } }, [
        h(MediaBlock, { key: "r", label: "Cover", verbs }),
        h(MediaBlock, { key: "c", shape: "round", floor: PORTRAIT_MIN_SIDE, verbs }),
      ]);
    },
  };
}

// Cover renders a locally-served cover/poster image (GET /covers/{file}), or
// the striped placeholder. Remote images are never hotlinked (CSP 'self').
// `zoomable` (detail heroes) makes a real cover open the full-screen Lightbox.
// `badge` is the word the PLACEHOLDER wears when there is no artwork — COVER for
// a book, POSTER for a film. It absorbed Movies.jsx's `Poster`, which was this
// component with three differences: an 8px radius instead of 6, --line instead
// of --ink-border, and an alt attribute reading `Poster of ${title}` in English
// in an app that ships Bengali. One artwork component, one placeholder word.
export function Cover({ path, title, large = false, hero = false, zoomable = false, badge = 'common.badge.cover' }) {
  const [zoom, setZoom] = useState(false);
  // hero: fills its (sized) wrapper at 2:3 — used by the detail header, where the
  // wrapper controls width and adds the drop shadow.
  if (hero) {
    if (path) {
      const img = (
        <img
          src={coverImgURL(path)}
          alt={title ? t("common.cover.alt", { title }) : ""}
          className="block w-full rounded-md object-cover"
          style={{
            aspectRatio: "2 / 3",
            border: "1px solid var(--ink-border)",
          }}
        />
      );
      if (!zoomable) return img;
      return (
        <>
          <Tooltip label={t("common.cover.zoom.tip")} className="block w-full">
            <button
              type="button"
              className="cover-zoom-btn"
              aria-label={title ? t("common.cover.zoom.aria", { title }) : t("common.cover.zoom.untitled.aria")}
              onClick={() => setZoom(true)}
            >
              {img}
            </button>
          </Tooltip>
          {zoom && <Lightbox path={path} title={title} onClose={() => setZoom(false)} />}
        </>
      );
    }
    return <Placeholder kind={t(badge)} className="w-full" />;
  }
  const size = large ? "h-36 w-24" : "h-14 w-10";
  if (path) {
    return (
      <img
        src={coverImgURL(path)}
        alt={title ? t("common.cover.alt", { title }) : ""}
        className={size + " shrink-0 rounded-md object-cover"}
        style={{ border: "1px solid var(--ink-border)" }}
      />
    );
  }
  return (
    <Placeholder kind={large ? t(badge) : ""} className={size + " shrink-0"} />
  );
}

// ViewIcon draws the tiles / list / table glyphs for the ViewToggle.
export function ViewIcon({ kind }) {
  const p = {
    width: 15,
    height: 15,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  if (kind === "tiles")
    return (
      <svg {...p} aria-hidden="true">
        <rect x="1.5" y="1.5" width="5.5" height="7" />
        <rect x="9" y="1.5" width="5.5" height="4.5" />
        <rect x="1.5" y="10" width="5.5" height="4.5" />
        <rect x="9" y="7.5" width="5.5" height="7" />
      </svg>
    );
  if (kind === "list")
    return (
      <svg {...p} aria-hidden="true">
        <line x1="2" y1="4" x2="14" y2="4" />
        <line x1="2" y1="8" x2="14" y2="8" />
        <line x1="2" y1="12" x2="14" y2="12" />
      </svg>
    );
  return (
    <svg {...p} aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="11" />
      <line x1="1.5" y1="6.5" x2="14.5" y2="6.5" />
      <line x1="6" y1="2.5" x2="6" y2="13.5" />
    </svg>
  );
}

// ViewToggle — the shared tiles / list / table switch (Library annotations +
// Catalogue dialogues), so both quote surfaces offer the same views.
// TWO VIEWS, NOT THREE. List was a middle setting nobody chose: a tile board
// already reads as a list at one column, and a table is what you switch to when
// you want to compare rows rather than read them. The third option cost a third
// of the switch's width to offer a fourth of a difference.
//
// A stored "list" survives in localStorage from before, which is what
// useWorkView migrates — see below.
export function ViewToggle({ value, onChange }) {
  return (
    <Toggle
      ariaLabel={t("common.view.toggle.aria")}
      value={value}
      onChange={onChange}
      options={[
        [
          "tiles",
          <>
            <ViewIcon kind="tiles" /> {t("common.view.tiles.label")}
          </>,
        ],
        [
          "table",
          <>
            <ViewIcon kind="table" /> {t("common.view.table.label")}
          </>,
        ],
      ]}
    />
  );
}

// useSort — shared table sort state (col + dir) with a comparator. apply(rows,
// valueFns) returns a sorted copy using valueFns[col](row) as the sort key.
// Reused by the tag/sticker manager tables and the search table view.
export function useSort(defaultCol, defaultDir = "asc") {
  const [sort, setSort] = useState({ col: defaultCol, dir: defaultDir });
  const toggle = (col) =>
    setSort((s) =>
      s.col === col
        ? { col, dir: s.dir === "asc" ? "desc" : "asc" }
        : { col, dir: "asc" },
    );
  const apply = (rows, valueFns) => {
    const vf = valueFns[sort.col];
    if (!vf) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = vf(a);
      const y = vf(b);
      if (x < y) return -dir;
      if (x > y) return dir;
      return 0;
    });
  };
  return { sort, toggle, apply };
}

// SortableTh — a clickable table header that shows the active sort arrow.
export function SortableTh({ col, label, sort, onSort, className = "" }) {
  // THE ARROW IS DRAWN, NOT TYPED. `▲`/`▼` are the reader's font's triangles —
  // solid on one platform, hollow on another, and sitting off the baseline the
  // header's own letters share. IconSortAsc/IconSortDesc are the app's, and they
  // are the same pair every other sort control in this app already uses.
  const arrow = sort.col !== col ? null
    : sort.dir === "asc" ? <IconSortAsc size={13} /> : <IconSortDesc size={13} />;
  return (
    <th
      className={"sortable " + className}
      onClick={() => onSort(col)}
      aria-sort={
        sort.col === col
          ? sort.dir === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <Tooltip label={t("common.table.sort.tip")} side="bottom">
        <span className="inline-flex items-center gap-1">
          {label}
          {arrow}
        </span>
      </Tooltip>
    </th>
  );
}

// filterChipClass styles the small toggle buttons in list filter rows.
export function filterChipClass(active) {
  return "tp-filter-chip tactile" + (active ? " active" : "");
}

// ChipSwitches — a row of independent on/off buttons, where a column of Yes/No
// toggles used to stand.
//
// THE TOGGLES WERE THE WRONG CONTROL FOR THE SHAPE OF THE QUESTION, and Settings
// had nine of them in one pop-up. A segmented Yes/No answers ONE question with
// two mutually exclusive answers; "which of these five does the deck ask?" is one
// question with five independent answers, and drawing it as five two-state
// controls spends a labelled row plus a 60px switch on each — a panel you scroll
// to reach the third of five options, where the answer is "the ones that are lit".
// A pressed chip carries the same bit in a quarter of the space, and the whole set
// is then readable at a glance instead of a row at a time.
//
// IT IS THE CONTROL THE REVIEW SCOPE CHIPS ALREADY WERE. Those three (books /
// films / quotes, in the same card) were hand-rolled from filterChipClass and a
// Tooltip, and they were the precedent this borrows rather than a second answer to
// the same question — which is why they now go through here too. One mechanism,
// three call sites, and the lock rule below written down once.
//
// A LOCKED CHIP REFUSES, IT DOES NOT DISAPPEAR AND IT IS NOT `disabled`. Both of
// this component's callers have a last-one-standing rule — the deck that must keep
// one question it can ask, the app that must keep one content section — and the
// reason has to reach the reader. `disabled` on a button eats the pointer events
// the tooltip is opened by, so the chip stays live, says so with `aria-disabled`,
// and swallows its own click; the caller draws the reason in words beside the row,
// because a bubble is something you have to know to ask for.
export function ChipSwitches({ options, onToggle, ariaLabel, className = "" }) {
  return (
    <div className={"flex flex-wrap items-center gap-2 " + className} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <Tooltip key={o.key} label={o.locked || o.hint || ""}>
          <button
            type="button"
            className={filterChipClass(o.on)}
            aria-pressed={o.on}
            // Coerced for the same reason aria-pressed is: a chip that only
            // announces the lock in one of the two states is read as a plain
            // button half the time.
            aria-disabled={!!o.locked}
            onClick={() => {
              if (o.locked) return;
              onToggle(o.key, !o.on);
            }}
          >
            {o.label}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

// FilterChip — a filter chip that can carry a glyph and lose its words.
//
// IT REUSES THE BUTTON MECHANISM RATHER THAN INVENTING A SECOND ONE, and that is
// the whole reason it exists. `.btn-icon` + `.btn-label` are what
// html[data-labels="off"] clips, the resolution auto→on/off already happens once
// in theme.js against the 768px breakpoint, and the preference already has a
// control in Settings → Appearance. A chip row that collapsed on its own measured
// width — or on a media query of its own — would be a second answer to "should
// buttons show their words", drifting from the first the day either is touched.
// So the chips answer the question the app has already asked.
//
// Clipped, not display:none, exactly as on a button: an icon-only scope row still
// reads as "All, Books, Annotations…" to a screen reader with no aria-label to
// bolt on and keep in sync. The Tooltip is what names it to everybody else —
// required, not decorative, because a glyph with its words clipped is otherwise
// unexplained on a phone, which is precisely where the clipping happens.
//
// `keepLabel` is the same opt-out it is on a button, and the same kind of chip
// takes it: the one whose meaning must not have to be learned. On the search
// scopes that is `All` — three characters, the default, and the way back.
export function FilterChip({ active, icon, keepLabel, label, tooltip, onClick, ...rest }) {
  const chip = (
    <button
      type="button"
      className={filterChipClass(active) + (icon && !keepLabel ? " has-btn-icon" : "")}
      // Coerced, so an unset `active` says "false" rather than dropping the
      // attribute. A toggle that only announces its state in one of the two states
      // is a toggle a screen reader reads as a plain button half the time.
      aria-pressed={!!active}
      onClick={onClick}
      {...rest}
    >
      {icon ? (
        <>
          <span className="btn-icon">{icon}</span>
          <span className={keepLabel ? "btn-label-fixed" : "btn-label"}>{label}</span>
        </>
      ) : (
        label
      )}
    </button>
  )
  // A chip that can never lose its words needs no bubble to explain them.
  if (!icon || keepLabel) return chip
  return <Tooltip label={tooltip || label}>{chip}</Tooltip>
}

// GenreFilter — the shared genre picker used by Library + Catalogue so both
// toolbars read identically: ONE dropdown holding every genre, with "All" as its
// first option.
//
// It was a strip of tactile chips (All + the most common genres) with the
// overflow tucked into a "More…" dropdown, sized by MEASURING how many chips fit
// the available width. That measurement was the problem, and 1.4.2 gives up on
// it rather than tuning it again. The row it measures against holds a dozen other
// controls whose widths change as the data does — a long series name, a
// two-digit count — so the answer was right only until something else on the row
// moved, and the failure was ugly in a specific way: a chip clipped mid-word
// against "More…", which reads as a rendering bug rather than a fitted layout.
// Chips also sorted the genres by frequency, so which ones were reachable
// without opening a dropdown changed as the library grew.
//
// A select has none of those failure modes, costs one tap for any genre instead
// of one tap for some and two for the rest, and is already how series, sort,
// group and shelf read on the same row — and how genre itself has read in the
// mobile filter sheet since 1.4.0. This is the chip strip catching up with it.
export function GenreFilter({ genres, value, onChange }) {
  if (!genres || genres.length === 0) return null;
  return (
    <Select
      ariaLabel={t("common.filters.genre.aria")}
      value={value}
      onChange={onChange}
      options={[["", t("common.filters.genre.all.label")], ...genres.map((g) => [g, g])]}
    />
  );
}

// seriesLabel renders a book/movie's series as "Name #1.5" (or just "Name").
export function seriesLabel(x) {
  if (!x.series) return "";
  return x.series_index ? `${x.series} #${x.series_index}` : x.series;
}

// bySeries orders by series name (unseried last), then position, then title —
// the "series" sort option shared by the Library and Movies lists.
export function bySeries(a, b) {
  const sa = a.series || "",
    sb = b.series || "";
  if (sa !== sb) return sa ? (sb ? sa.localeCompare(sb) : -1) : 1;
  const ia = a.series_index || 0,
    ib = b.series_index || 0;
  if (ia !== ib) return ia - ib;
  return a.title.localeCompare(b.title);
}

// byLastRead orders by when you last had the thing in your hands — most recent
// first — with everything you have never read after it, alphabetically.
//
// NEVER-READ GOES LAST, ALWAYS. Most libraries here are mostly unread: this app
// exists to keep quotes, and a book can be shelved, quoted and never once logged
// as read. If the undated ones sorted first, or scattered through, the sort
// would answer a question nobody asked. They keep their own order — by title,
// because "no date" is not a tie worth breaking randomly, and a stable
// alphabetical tail is something you can actually look things up in.
//
// Dates are PARTIAL ('2019' | '2019-05' | '2019-05-02') and compared as strings,
// which is the property the schema was designed around and noted_at has relied
// on since 0008. '2019-05' > '2019' is the honest reading of the two: May is a
// more precise claim than "sometime that year", and there is nothing to do with
// the imprecision except order it consistently.
// UNDATED LANDS LAST WITHOUT BEING SENT THERE, and this is the one thing to know
// before editing it. "" is a prefix of every string, so it always compares FIRST
// ascending — and this compare is inverted for "most recent first", which puts
// it last. Two explicit `if (!da) return 1` guards were written here and a
// mutation proved them unreachable: deleting both changed no result, because the
// direction was already doing their work.
//
// So the invariant lives in the test, not in a branch that cannot run. If this
// ever sorts oldest-first, the guards have to come back — the unread belong at
// the bottom either way, and that is the one thing flipping the comparison would
// silently undo.
export function byLastRead(a, b) {
  const da = a.last_read_at || "",
    db = b.last_read_at || "";
  if (da !== db) return db.localeCompare(da); // most recent first; "" sorts last
  return (a.title || "").localeCompare(b.title || "");
}

// formatYear — how a publication or release year is written down.
//
// 0 means "not recorded" and has since the column existed, so it renders as
// nothing rather than as a year. A negative year is BCE, and it is written with
// the sign turned into a word: -380 is "380 BCE", never "-380", which reads as a
// countdown. CE is left unmarked, because writing "1954 CE" on a novel is
// pedantry — the era only needs saying when it is the unusual one.
//
// `circa` is display-only by design (see migration 0030): it never touches
// sorting or bucketing, because an approximate year is still that year for
// every purpose except how it is printed. A "c." that changed the ordering
// would put the timeline and the shelf into disagreement about the same book.
export function formatYear(year, circa = false) {
  const y = Number(year);
  if (!y) return ""; // 0, null, undefined, NaN — all "no year recorded"
  // FOUR MESSAGES RATHER THAN A PREFIX PLUS A SUFFIX: "c." and "BCE" are words
  // that a language may want on the other side of the number, or joined to it,
  // and a concatenation here would take that choice away.
  const key = circa
    ? y < 0
      ? "common.year.circa.bce.label"
      : "common.year.circa.ce.label"
    : y < 0
      ? "common.year.bce.label"
      : "common.year.ce.label";
  return t(key, { year: y < 0 ? -y : y });
}

// parseYearInput — the inverse of formatYear, and deliberately forgiving.
//
// It reads what formatYear writes, so a year round-trips through the editor
// unchanged, and it also reads the forms people actually type: "380 BCE",
// "380 BC", "-380", "c. 380 BCE", "1954 CE". The era word wins over a leading
// minus, so "-380 BCE" is 380 BCE rather than 380 CE by double negation.
//
// Circa is parsed from the same string on purpose. "c. 380 BCE" is one phrase
// that anyone who owns an old book already knows how to write; splitting it
// across a number field and a checkbox asks them to take it apart first.
//
// Anything unreadable returns 0, which is what this field has always meant by
// "no year" — the same answer the old Number() coercion gave, for the same
// reason.
export function parseYearInput(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return { year: 0, circa: false };
  let circa = false;
  const c = s.match(/^(?:circa|ca|c)\.?\s*/i); // longest first: "circa" before "c"
  if (c && c[0].length < s.length) {
    circa = true;
    s = s.slice(c[0].length).trim();
  }
  let bce = false;
  const era = s.match(/\s*\b(b\.?\s*c\.?(?:\s*e\.?)?|a\.?\s*d\.?|c\.?\s*e\.?)\.?\s*$/i);
  if (era) {
    bce = era[1].replace(/[^a-z]/gi, "").toLowerCase().startsWith("b");
    s = s.slice(0, era.index).trim();
  }
  const n = Number(s);
  if (!Number.isInteger(n) || n === 0) return { year: 0, circa: false };
  return { year: bce ? -Math.abs(n) : n, circa };
}

// FavoriteStar kept its name for compat but renders hearts now (§6).
export function FavoriteStar({ value, onChange }) {
  return <Hearts value={value} onChange={onChange} />;
}


// ColorSwatches renders the four annotation colours as an ARIA radio group;
// '' = nothing picked (the list filters, which clear by re-picking in their own
// onChange — a card must not: the server has no "no colour", see validColor).
// One tab stop for the whole group (roving tabindex); arrows MOVE focus without
// committing and Enter/Space picks, the same split Select uses — selection
// following focus would fire a PUT per keystroke from the card quick-pick.
// Each dot is a transparent hit box around the 20px circle, so the mobile touch
// pass can grow the BOX to 44px high without changing how the dot looks.
// ColorSwatches — the four colour categories as a radio group, and the one
// control every capture form, filter row and card shares.
//
// It draws the reader's NAMES, not the colour words: "Pick blue" is a
// description of a highlighter, and the whole point of naming a category is that
// the picker then asks the question you actually have. `categoryName` falls back
// to the colour word for a slot nobody has named, so a fresh account reads
// exactly as it did before.
//
// A HIDDEN slot is dropped from the CHOICES but never from a quote that already
// wears it, which is why `value` is added back in below. Hiding is about
// tidying a picker you have stopped using, and a quote silently changing colour
// because of that would be the app editing your library to match a preference.
//
// `showAll` renders every slot regardless — Settings needs to show the one you
// are in the middle of hiding.
// `disabled` exists for one caller: the selection bar holding a mode with nothing
// picked in it (see useSelection). Six live dots over an empty selection is a
// control whose every outcome is an error from the server, and greying a row of
// dots is the only way a radiogroup can say so.
export function ColorSwatches({ value, onChange, ariaLabel, showAll = false, collapsible = false, mini = false, disabled = false }) {
  const ref = useRef(null);
  const offered = showAll
    ? ANNOTATION_COLORS
    : ANNOTATION_COLORS.filter((c) => !categoryHidden(c) || c === value);
  // The tab stop is the picked dot, or the first when nothing is picked (a
  // filter sitting at "all") — the group must never fall out of tab order.
  const focusIndex = Math.max(0, offered.indexOf(value));
  const onKey = (e) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const btns = ref.current?.querySelectorAll("button");
    if (!btns?.length) return;
    const from = [...btns].indexOf(document.activeElement);
    const next = (((from < 0 ? focusIndex : from) + step) % btns.length + btns.length) % btns.length;
    btns[next].focus();
  };
  const dots = (
    <span
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel || t("common.field.colour.label")}
      onKeyDown={onKey}
      className="flex items-center gap-1.5"
    >
      {offered.map((c, i) => (
        <Tooltip key={c} label={t("common.colour.pick.tip", { name: categoryName(c) })}>
          <button
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={categoryName(c)}
            tabIndex={i === focusIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(c)}
            className="color-dot-btn"
          >
            <span className={"color-dot " + colorDotClass[c] + (value === c ? " active" : "")} />
          </button>
        </Tooltip>
      ))}
    </span>
  );
  // `mini` skips the container query and always draws the single trigger. The
  // selection bar wants that unconditionally: it is a strip of glyphs, and six
  // dots in the middle of it would be the one control wide enough to push the
  // others off a phone. `collapsible` is the card's version of the same idea —
  // decide by width — and the two must not be confused.
  // framed with mini, because the two callers differ in exactly this way: `mini` is
  // the selection bar asking for the collapsed trigger among bordered buttons, while
  // the `.cs-mini` wrapper below is a card deciding by width, where a frame would be
  // furniture. Same component, two rooms.
  if (mini) return <ColorMenu value={value} offered={offered} onChange={onChange} ariaLabel={ariaLabel} disabled={disabled} framed />;
  if (!collapsible) return dots;
  // Both forms are rendered and a container query picks one. The alternative is
  // measuring, and measuring a control that lives inside a masonry cell means a
  // ResizeObserver per card plus a re-render on every reflow — for a decision
  // CSS can make from the card's own width.
  return (
    <>
      <span className="cs-full">{dots}</span>
      <span className="cs-mini">
        <ColorMenu value={value} offered={offered} onChange={onChange} ariaLabel={ariaLabel} disabled={disabled} />
      </span>
    </>
  );
}

// ColorMenu — the colour picker when there is no room for six of anything: the
// current colour as one dot with a chevron, opening a list.
//
// The list is the reason this is not simply a smaller row of dots. Six unlabelled
// blobs shrunk to fit are six things you cannot tell apart on a phone, and since
// 1.7.1 the categories have had NAMES the reader chose — so the collapsed form
// is the one place they can actually be read. A cramped row hides information
// the expanded row was already failing to show.
// It is PORTALLED and fixed-positioned, which is not fussiness. A quote card
// sets `container-type: inline-size` (that is what chooses this form over the
// row), and a container is `contain: layout` — which makes the card a stacking
// context. An absolutely-positioned list inside one cannot be lifted above a
// neighbouring card no matter what z-index it carries, so a menu that opened
// past the card's edge would slide UNDER the card beside it. Anchoring to the
// viewport puts it where a popup belongs and flips it when there is no room.
// `framed` DRESSES THE TRIGGER AS AN ORDINARY BUTTON, for the selection bar.
//
// Bare, this control was the least visible thing in that row and the one people
// looked for first. Two reasons, and both had to go. `.cs-menu-btn` sets
// `border: none; background: none`, which is right on a card — the picker sits in a
// row of dots and a frame around one of them would be furniture — and wrong in a
// bar where every neighbour is a bordered 44px circle. And the bar passes
// `value=""`, because a selection of forty quotes has no one current colour, so the
// dot rendered EMPTY at 65% opacity: a faint grey ring on a faint background.
//
// So framed borrows the real `tp-btn tp-btn-ghost` classes rather than restating
// their look in a scoped rule. That way it inherits the theme and aesthetic
// variants — the paper radius, the dark-mode shadow — instead of drifting from them
// the first time either changes.
function ColorMenu({ value, offered, onChange, ariaLabel, disabled = false, framed = false }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  // Above by preference: this control sits low on a card, so a list that
  // dropped downwards would cover the quote you are colouring.
  const { popRef, style } = useAnchoredPosition(open, box, { prefer: "above", minHeight: 140 });
  const close = () => setOpen(false);
  useDismiss(open, close, [box, popRef], {
    onEscape: () => box.current?.querySelector("button")?.focus(),
  });

  return (
    <span className="cs-menu-wrap" ref={box}>
      <Tooltip label={value ? t("common.colour.current.tip", { name: categoryName(value) }) : t("common.colour.pick.empty.tip")}>
        <button
          type="button"
          className={"cs-menu-btn" + (framed ? " cs-menu-btn-framed tp-btn tp-btn-ghost tactile" : "")}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          {/* An empty dot says nothing, so the framed trigger shows the palette
              glyph until a colour is actually chosen — which in the selection bar
              is never, because a bulk action has no current value. The chevron goes
              with it: in a row of single-glyph buttons a second mark on one of them
              reads as a different KIND of control. */}
          {framed && !value ? (
            <IconPalette />
          ) : (
            <>
              <span className={"color-dot " + (colorDotClass[value] || "") + (value ? " active" : "")} />
              <IconChevron open={open} size={14} />
            </>
          )}
        </button>
      </Tooltip>
      {open && createPortal(
        <span ref={popRef} className="cs-menu token-menu" role="radiogroup" aria-label={ariaLabel} style={style}>
          {offered.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={value === c}
              className="cs-menu-row"
              onClick={() => { onChange(c); close(); }}
            >
              <span className={"color-dot " + colorDotClass[c] + (value === c ? " active" : "")} />
              <span className="cs-menu-name">{categoryName(c)}</span>
            </button>
          ))}
        </span>,
        document.body,
      )}
    </span>
  );
}

// ---- mobile primitives (§7) ----

const ICON_SIZE = 24

// IconButton — a glyph-only 44px control, and the standard of the two icon
// sizes (the other is .field-icon-btn, 34px, for controls that sit inside a
// form row). It carries its OWN Tooltip: a button with no words has to say what
// it is on every device, and threading a wrapper through forty call sites is
// how half of them end up without one. `ariaLabel` doubles as the tooltip label
// (they should say the same thing anyway); pass `tooltip` to differ, or
// `tooltip={null}` for the rare button whose label is already visible beside
// it. `tipSide` picks which way the bubble opens.
//
// `danger` tints it with --error. It exists because Library and Movies were
// each reaching past the component with an inline style to recolour the delete
// button — and, since `style` arrives in ...rest and lands after this one, a
// caller doing that had to restate all four sizing properties or lose the 44px
// box. `style` is merged now rather than replaced, so a partial override is a
// partial override.
// `label` OPTS THIS BUTTON INTO THE Button labels PREFERENCE, and without it
// nothing changes.
//
// IconButton was glyph-only by construction: one child, a fixed 44px square, and
// no .btn-label span anywhere. So `Button labels: Show` could not reveal a name it
// never rendered and `Hide` could not clip one — a whole family of controls sat
// outside a preference that claims to govern the app. The selection bar was built
// entirely from that family, which is why it ignored the setting in both
// directions.
//
// Passing `label` renders the same two spans Button does, so the existing CSS does
// all of it: .btn-label is clipped under data-labels="off" (that rule is
// deliberately not scoped to .tp-btn, which is what lets other controls opt in),
// and .tp-btn.has-btn-icon squares back to 44px — the same 44px this button uses
// when it has no label, so a labelled row and an unlabelled one line up.
//
// The inline width is dropped ONLY when there is a label, because an inline width
// would beat the stylesheet and pin the pill shut. Height stays: a 44px row is a
// 44px row either way.
// `ok` is the affirmative twin of `danger`, added because its absence was being
// worked around: the Add sheet's ✓ is one of these and wore `.field-icon-btn-ok`,
// the 34px family's colour class, to go green. One family borrowing another's
// stylesheet for a colour is how two families stop being two families.
export function IconButton({ icon, label, ariaLabel, tooltip, tipSide = "top", danger = false, ok = false, keepLabel = false, className = "", wrapClassName = "", onClick, style, ...rest }) {
  const tip = tooltip === undefined ? ariaLabel : tooltip
  const named = label != null && label !== ""
  return (
    <Tooltip label={tip} side={tipSide} className={wrapClassName}>
      <button
        type="button"
        className={`tp-btn tp-btn-ghost tactile flex items-center justify-center rounded-full${named && !keepLabel ? " has-btn-icon" : ""}${named && keepLabel ? " has-fixed-label" : ""}${danger ? " tp-btn-danger" : ""}${ok ? " tp-btn-ok" : ""} ${className}`}
        style={named
          ? { height: 44, flexShrink: 0, ...style }
          : { width: 44, height: 44, padding: 0, flexShrink: 0, ...style }}
        aria-label={ariaLabel}
        onClick={onClick}
        {...rest}
      >
        {named ? (
          <>
            <span className="btn-icon">{icon}</span>
            <span className={keepLabel ? "btn-label-fixed" : "btn-label"}>{label}</span>
          </>
        ) : (
          icon
        )}
      </button>
    </Tooltip>
  )
}

// FieldIconButton — the OTHER icon size, 34px, and until now the only primitive
// in this app that was never a component.
//
// It was a class string: `field-icon-btn tactile`, hand-written at 46 call sites
// across 13 files, with `-ok`, `-danger` and `-boxed` variants and two latches
// (`is-active`, `is-busy`) spelled out by hand at each one. The audit that found
// it was looking for sloppiness and did not find much — all 46 carried an
// aria-label, all 46 were wrapped in a Tooltip, and exactly one had drifted
// (Home.jsx was missing `tactile`, so one button in the app did not press when you
// pushed it). Copy-paste held for a remarkably long time.
//
// It still had to become this, for the reason the drift is not the point:
//
//   A CLASS STRING CANNOT MAKE A DECISION. `IconButton` gained an opt-in `label`
//   in 1.13.0 so the 44px family could honour the Button labels preference. The
//   34px family could not opt into anything, because there was no place to put the
//   opting. Forty-six buttons sat outside a preference that claims to govern the
//   app, not by a decision but by never having been asked.
//
// THE ANSWER IS THAT THIS SIZE IS NAMELESS, AND THERE IS DELIBERATELY NO `label`
// PROP. 34px exists precisely because it sits inside a row that already spends its
// width on something else — a text input with a ✓ and a ✕ after it, a cover's
// control cluster, a card's action row that already wraps at six colour dots. A
// word beside the glyph is the one thing there is no room for. That is why the
// second size exists at all, and adding words here would collapse the distinction
// between the two families rather than complete it.
//
// So the rule the app now has is two sizes and two rules:
//
//   44px IconButton  — can be named, opts in with `label`, honours the preference.
//   34px this        — nameless by construction; the name lives in the tooltip
//                      and the accessible name, both of which this guarantees.
//
// Written down once, in a component, instead of remembered 46 times.
//
// The Tooltip is carried here for the same reason IconButton carries its own: a
// button with no words has to say what it is on every device, and threading a
// wrapper through forty-six call sites is how a handful end up without one. That
// the old sites all had one is luck this no longer depends on.
export function FieldIconButton({
  icon,
  ariaLabel,
  tooltip,
  tipSide = "top",
  ok = false,
  danger = false,
  boxed = false,
  active = false,
  busy = false,
  className = "",
  wrapClassName = "",
  onClick,
  ...rest
}) {
  const tip = tooltip === undefined ? ariaLabel : tooltip
  return (
    <Tooltip label={tip} side={tipSide} className={wrapClassName}>
      <button
        type="button"
        className={
          "field-icon-btn tactile" +
          (ok ? " field-icon-btn-ok" : "") +
          (danger ? " field-icon-btn-danger" : "") +
          (boxed ? " field-icon-btn-boxed" : "") +
          (active ? " is-active" : "") +
          (busy ? " is-busy" : "") +
          (className ? ` ${className}` : "")
        }
        aria-label={ariaLabel}
        onClick={onClick}
        {...rest}
      >
        {icon}
      </button>
    </Tooltip>
  )
}

const iconStroke = { width: ICON_SIZE, height: ICON_SIZE, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.85, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }

// ---- iconFill: the four reasons a glyph may be solid ------------------------
//
// THE APP IS WIREFRAME AND STAYS WIREFRAME. `iconStroke` above is the rule; this is the
// exception, and an exception has to argue for itself. Only four arguments count:
//
//   1. It is the ON state of a pair — the favourite, set (IconHeartOn against IconHeart).
//   2. The glyph names a PLACE rather than a job. That is the whole rail: solid says
//      "somewhere to go" before the word beside it is read, which is the same thing the
//      shell says one step later when the active row wears an accent fill.
//   3. The subject is a silhouette in life, where an outline at 19px turns the shape into
//      a ring. The mortarboard is the case; a face and a film reel were both rejected,
//      because each already sits inside something that supplies the ring.
//   4. The fill carries information — the palette's wells hold the category colours.
//
// A key (tick, plus, close, chevron, three dots) is a pen mark with nothing inside to
// fill, and a letterform (translate, the question mark) becomes a blob at 19px. Neither
// qualifies. icons-fill.test.jsx fails a filled glyph that is not on the declared list.
//
// PHOSPHOR ICONS, MIT — https://github.com/phosphor-icons/core, fill weight, drawn on a
// 256 box. The box is why these do not need the 1.85 stroke and why they cannot collide
// with the drawn set in the near-duplicate test: they are a different coordinate space,
// not a different weight of the same drawing.
// EVERY FILL OVERRIDES THE viewBox, and the default here is only a fallback. Phosphor
// draws each glyph to its own margins rather than to a shared one, so straight from
// the pack the film reel occupies 0.59 of its box and `users` 0.98 — thirteen tabs at
// thirteen sizes. Each glyph therefore carries a box cropped to its own ink, sized so
// the long side is 0.82 of it. That is uniform scaling: nothing is stretched, the
// drawing stays the pack's, and icons.test.jsx holds the 0.82 for the whole rail.
const iconFill = { width: ICON_SIZE, height: ICON_SIZE, viewBox: "0 0 256 256", fill: "currentColor", stroke: "none", "aria-hidden": "true" }

export function IconBack() { return <svg {...iconStroke}><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg> }
export function IconFilter() { return <svg {...iconStroke}><path d="M22 3H2l9 9v9l4-2v-7z"/></svg> }
// IconSort — three rules of falling length with a down arrow beside them: the order
// of a list, and the direction it runs in. An OUTLINE, because it names a job rather
// than a place — the same reason IconFilter beside it is one, and the icon rule's
// four exceptions do not cover a control.
export function IconSort() { return <svg {...iconStroke}><path d="M4 6h11"/><path d="M4 12h7"/><path d="M4 18h4"/><path d="M18 5v14"/><path d="M15 16l3 3 3-3"/></svg> }
export function IconExport() { return <svg {...iconStroke}><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 18h16"/></svg> }
export function IconEdit() { return <svg {...iconStroke}><path d="M17 3l4 4L7 19H3v-4z"/></svg> }
export function IconDelete() { return <svg {...iconStroke}><path d="M3 6h18"/><path d="M8 3V2h8v1"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg> }
export function IconPlus() { return <svg {...iconStroke}><path d="M12 5v14"/><path d="M5 12h14"/></svg> }
export function IconSearch() { return <svg {...iconStroke}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg> }
// ---- the phone dock's two menu keys -----------------------------------------
//
// BOTH ARE OUTLINES, and the rail's own glyphs for the same destinations are not.
// The fill rule's second exception is "the glyph names a PLACE rather than a job",
// and that is exactly what these two do NOT do: a dock key that opens a list of
// four places is a control, and the place is the row you press inside it. Drawing
// them solid would make two keys claim to be somewhere you already are.
//
// IconBoards — a card with two shorter rules stacked behind it: SEVERAL boards,
// one on top of another, none of them privileged. The alternative was a compass,
// which says "navigate" but says nothing about what is being navigated, and the
// four things behind this key are the only reason it exists.
export function IconBoards() { return <svg {...iconStroke}><rect x="3" y="8.5" width="18" height="12.5" rx="2.5"/><path d="M6 5.5h12"/><path d="M8.5 2.5h7"/></svg> }
// IconTools — the settings sliders, in outline. The rail's Settings row is the
// filled version of this drawing (IconSliders), which is the point: the key opens
// Settings, Stats and Metadata, so it wears the family the biggest of the three
// belongs to, and the outline says it is the door rather than the room.
export function IconTools() { return <svg {...iconStroke}><path d="M4 6h8"/><path d="M16.5 6H20"/><circle cx="14.25" cy="6" r="2.25"/><path d="M4 12h3.5"/><path d="M12 12h8"/><circle cx="9.75" cy="12" r="2.25"/><path d="M4 18h8"/><path d="M16.5 18H20"/><circle cx="14.25" cy="18" r="2.25"/></svg> }
// IconSearchGlobe — the same magnifier, with the world drawn inside its lens.
//
// A globe rather than a badge, and IN the lens rather than beside it, because
// the thing being said is not "there is a mode" but "this glass is looking at
// everything". An equator and one meridian are enough: at 28px a third line is
// a smudge, and the silhouette has to stay the search icon's or the button
// stops being recognisable as Search.
// IconGlobe — "a web page", which is a KIND of link and not a missing one.
//
// An equator and one meridian, the same two lines IconSearchGlobe draws inside
// its lens, at the plain size: a third parallel is a smudge at 18px, and the two
// glyphs have to read as the same world in two places. It is deliberately not a
// dashed box and not inked with --error — a reader who linked to the open web has
// not done anything wrong, and a failure colour would say they had.
// IconSortAsc / IconSortDesc — which end of the order is at the top.
//
// THREE BARS AND AN ARROW, and the bars are the giveaway rather than decoration:
// an arrow alone says "up" and not "smallest first", and the pair have to be
// told apart at a glance in a row where they occupy the same 34px. The bars grow
// downward for ascending and shrink for descending, so the picture IS the order
// the board is in — a reader does not have to remember which way the arrow means.
export function IconSortAsc({ size = ICON_SIZE }) {
  return (
    <svg {...iconStroke} width={size} height={size}>
      <path d="M4 7h5"/><path d="M4 12h8"/><path d="M4 17h11"/>
      <path d="M19 5v14"/><path d="M16.2 16.2 19 19l2.8-2.8"/>
    </svg>
  )
}

export function IconSortDesc({ size = ICON_SIZE }) {
  return (
    <svg {...iconStroke} width={size} height={size}>
      <path d="M4 7h11"/><path d="M4 12h8"/><path d="M4 17h5"/>
      <path d="M19 19V5"/><path d="M16.2 7.8 19 5l2.8 2.8"/>
    </svg>
  )
}

export function IconGlobe({ size = ICON_SIZE }) {
  return (
    <svg {...iconStroke} width={size} height={size}>
      <circle cx="12" cy="12" r="8.4"/>
      <path d="M3.6 12h16.8"/>
      <path d="M12 3.6c2 2.3 3.1 5.2 3.1 8.4s-1.1 6.1-3.1 8.4c-2-2.3-3.1-5.2-3.1-8.4s1.1-6.1 3.1-8.4"/>
    </svg>
  )
}

export function IconSearchGlobe() {
  return (
    <svg {...iconStroke}>
      <circle cx="11" cy="11" r="7"/>
      <path d="M21 21l-4.3-4.3"/>
      <path d="M4.2 11h13.6"/>
      <path d="M11 4.1c1.7 1.9 2.6 4.3 2.6 6.9s-.9 5-2.6 6.9c-1.7-1.9-2.6-4.3-2.6-6.9s.9-5 2.6-6.9"/>
    </svg>
  )
}
// IconQuote — quotation marks inside a square speech bubble: the Quotes tab, and
// the top-bar / drawer capture entry.
//
// THE MARKS ALONE DREW TOO SMALL, and the reason is measurable rather than a
// matter of taste. Every glyph on this grid is judged by how much of the 24×24
// box it fills, and its neighbours in the nav fill nearly all of it — IconBooks
// spans 17×15, IconReel 17×17. A bare pair of quote marks spanned 13×10, a
// little over half the area, so the Quotes tab read as the same picture at a
// smaller size than the two tabs beside it. Nothing was wrong with the drawing;
// there was just not enough of it.
//
// The bubble is what fills the box, and it is not only packaging: a speech
// bubble is what these three screens have in common — a line somebody said —
// and it is the shape the app's own mark already uses. Square rather than
// round, with a tail at the bottom left, because the set runs geometric.
//
// The marks stay FILLED inside the outlined bubble. Outlined quote marks read as
// the digits "66", which is why they were filled to begin with; the bubble is
// stroked like every other glyph, so the icon carries one weight and one fill in
// the places each belongs.
export function IconQuote() {
  return (
    <svg {...iconStroke}>
      <path d="M6.5 4.5h11a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6.2L7 20.9v-3.4h-.5a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z" />
      <path d="M8.3 14h1.9l1.2-2.6V8H7.4v3.4h1.8L8.3 14Z" fill="currentColor" stroke="none" />
      <path d="M13.5 14h1.9l1.2-2.6V8h-4v3.4h1.8L13.5 14Z" fill="currentColor" stroke="none" />
    </svg>
  )
}
// IconEye / IconEyeOff — hiding something without deleting it. Two callers now:
// a colour category put away in Settings, and a quote board folded out of the
// list. They were private to Settings.jsx until the second caller arrived, which
// is the moment a glyph stops being one screen's drawing and becomes the app's
// word for an idea.
//
// Drawn at the 18px the dense controls use rather than the 24px grid, because
// both callers sit inside a row rather than in a bar.
export function IconEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  )
}
export function IconEyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.9 5.9A9.3 9.3 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8" />
      <path d="M6.3 7.7A17.6 17.6 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 3.6-.7" />
      <path d="M4 4l16 16" />
    </svg>
  )
}
export function IconGrid() { return <ViewIcon kind="tiles" /> }
export function IconList() { return <ViewIcon kind="list" /> }
export function IconTable() { return <ViewIcon kind="table" /> }
export function IconMore({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/></svg> }
// IconShare — the node graph, and NOT a tray with an arrow in it.
//
// It was that tray, and IconUpload is also a tray with an arrow in it, differing
// by about a pixel and a half of arrow. The two appear in the same rows — a
// quote card offers share, the tag manager offers upload — so the one thing a
// glyph has to do, be told apart at 24px without reading a label, neither did.
// The graph is the universally-learned share mark and shares no geometry with a
// tray, which is the actual requirement.
export function IconShare() { return <svg {...iconStroke}><circle cx="17.5" cy="5.5" r="2.4"/><circle cx="17.5" cy="18.5" r="2.4"/><circle cx="6.5" cy="12" r="2.4"/><path d="m8.7 10.9 6.6-3.9"/><path d="m8.7 13.1 6.6 3.9"/></svg> }
export function IconUpload() { return <svg {...iconStroke}><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/><path d="M12 3.5v11"/><path d="m7.5 8 4.5-4.5 4.5 4.5"/></svg> }
export function IconLink() { return <svg {...iconStroke}><path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 1 0-5-5l-1.5 1.5"/><path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 1 0 5 5l1.5-1.5"/></svg> }
// IconMetadata — an arrow landing INSIDE a record card, because that is what
// "fetch covers and metadata" does: it fills fields in rows you already have.
//
// The old drawing was an arrow landing on a baseline, which is IconExport — the
// same three strokes at coordinates half a unit apart. They sit two buttons
// apart on the Metadata console, one pulling data in and one pushing it out, and
// were the same picture. The card is what makes this one legible: the arrow has
// somewhere to arrive.
export function IconMetadata() { return <svg {...iconStroke}><rect x="3.5" y="11" width="17" height="9.5" rx="2.5"/><path d="M12 3v5.6"/><path d="m9 5.8 3 3 3-3"/><path d="M7.5 15h9"/><path d="M7.5 18h5"/></svg> }
export function IconMenu() { return <svg {...iconStroke}><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h12"/></svg> }
export function IconCheck() { return <svg {...iconStroke}><path d="M5 13l4 4L19 7"/></svg> }
export function IconClose() { return <svg {...iconStroke}><path d="M6 6l12 12M18 6 6 18"/></svg> }
// The two in-progress marks, drawn in the same ink-stroke hand as the rest: an
// open book for a book on the go, a play triangle for a film or show. These are
// the ONLY icons the shelf lifecycle puts on artwork — every other state is
// carried by its colour bar (StatusBar), so a settled cover stays unmarked. Each
// takes a size so one glyph serves both the 18px cover badge (ReadingBadge) and a
// 24px menu row. The play triangle is filled as well as stroked: an outline alone
// reads as a stray shape at badge size rather than a mark someone put there.
export function IconReading({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="-8.6 -4.6 273.2 273.2" width={size} height={size}><path d="M240,80V200a8,8,0,0,1-8,8H160a24,24,0,0,0-24,23.94,7.9,7.9,0,0,1-5.12,7.55A8,8,0,0,1,120,232a24,24,0,0,0-24-24H24a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8H88a32,32,0,0,1,32,32v63.73a8.17,8.17,0,0,0,7.47,8.25,8,8,0,0,0,8.53-8V104a32,32,0,0,1,32-32h64A8,8,0,0,1,240,80ZM88.81,56H89a47.92,47.92,0,0,1,36,17.4,4,4,0,0,0,6.08,0A47.92,47.92,0,0,1,167,56h.19a4,4,0,0,0,3.54-5.84,48,48,0,0,0-85.46,0A4,4,0,0,0,88.81,56Z"/></svg> }
// IconReadAgain — an open book with NO FILL, for the shelf-move VERB.
//
// FILL IS A STATE, STROKE IS AN ACT, and this app already draws the line that way
// everywhere else. IconReading is a filled book because it marks what a work IS —
// the shelf chip, the help entry beside it. "Read it again" is something you DO,
// and it was borrowing the state mark, so a menu of five stroke verbs had one
// solid glyph in it that read as a badge rather than a button.
export function IconReadAgain({ size = ICON_SIZE }) {
  return (
    <svg {...iconStroke} width={size} height={size}>
      <path d="M12 7.1C10.6 5.8 8.7 5.1 6.7 5.1H3.6v11.6h3.1c2 0 3.9.7 5.3 2" />
      <path d="M12 7.1c1.4-1.3 3.3-2 5.3-2h3.1v11.6h-3.1c-2 0-3.9.7-5.3 2" />
      <path d="M12 7.1v11.6" />
    </svg>
  );
}
export function IconWatching({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="1.2 9.2 253.7 253.7" width={size} height={size}><path d="M168,224a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,224ZM232,64V176a24,24,0,0,1-24,24H48a24,24,0,0,1-24-24V64A24,24,0,0,1,48,40H208A24,24,0,0,1,232,64Zm-68,56a8,8,0,0,0-3.41-6.55l-40-28A8,8,0,0,0,108,92v56a8,8,0,0,0,12.59,6.55l40-28A8,8,0,0,0,164,120Z"/></svg> }
export function IconCalendar({ size = 18 }) { return <svg {...iconStroke} width={size} height={size}><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3.5v3"/><path d="M16 3.5v3"/></svg> }
// IconHelp — the "?" every screen's help button wears. Circled so it reads as a
// standing affordance rather than punctuation someone forgot to delete.
export function IconHelp({ size = 22 }) { return <svg {...iconStroke} width={size} height={size}><circle cx="12" cy="12" r="8.75"/><path d="M9.4 9.5a2.6 2.6 0 1 1 3.2 2.5c-.5.15-.75.5-.75 1v.6"/><path d="M11.85 16.6v.01"/></svg> }
// IconDetails — the work Details panel (the old "Edit" button's replacement): a
// record card with its lines of metadata, not a pencil, because Details is a
// place to read first and edit second.
export function IconDetails({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M7.5 9h9"/><path d="M7.5 12.5h9"/><path d="M7.5 16h5"/></svg> }
// IconCopy — copy a value to the clipboard (the device pairing code).
export function IconCopy({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><rect x="9" y="9" width="11.5" height="11.5" rx="2.5"/><path d="M15 6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15"/></svg> }
// IconRevert — put something back the way it was: a field before a lookup match
// overwrote it (the merge screen's per-row undo), a filter sheet to its defaults,
// or an item out of the bin.
//
// The bin deliberately does NOT get its own glyph. "Restore" there means the same
// act this already draws, and the one drawing it must not be confused with is
// IconRestore — that is the backup box opened upward, which replaces the whole
// instance and logs everyone out. Same English word, two very different buttons.
export function IconRevert({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><path d="M4 10h9.5a5 5 0 0 1 0 10H8"/><path d="m7.5 6-3.5 4 3.5 4"/></svg> }
// IconChevron — a disclosure caret that points where it will go. Promoted out of
// CoverPicker.jsx, where it had been the only glyph in the app defined outside
// this file: the edition-group row needed something that was not a "+", because
// a "+" promises an immediate add and a group opens its editions instead.
// Everything with a fold now draws the same caret.
export function IconChevron({ open = false, size = 22 }) { return <svg {...iconStroke} width={size} height={size}><path d={open ? 'M6 14.5 12 8.5l6 6' : 'M6 9.5 12 15.5l6-6'}/></svg> }

// ---- the rest of the vocabulary ------------------------------------------
// Drawn from the button inventory rather than from a wishlist: every glyph below
// has at least one call site in the sweep that follows. The plan for this
// release guessed at twenty-six; the tree held nineteen distinct GhostButton
// labels in total, most of them one-off. Counting first is why this list is
// short.

// IconOpen — leave this screen for the thing itself (the Metadata console's
// per-row "Open", which jumps to the work in the Library or Catalogue).
export function IconOpen({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><path d="M14 3.5h6.5V10"/><path d="M20.5 3.5 12 12"/><path d="M18 14v4.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2H10"/></svg> }
// IconMerge — two lines becoming one, for the duplicate finder's "merge into
// keeper". The quotes of the losing rows move onto the survivor, which is
// exactly what the picture says.
// IconArrow — "this becomes that". The import previews, the cleanup rows and the
// metadata console all draw a step from one value to another, and all three drew
// it as the character `→`: the reader's font's arrow, at the reader's font's
// weight, sitting off the baseline every other glyph on the row shares. Same
// argument as the credit row's `✎`, and the same fix.
//
// `dir` because two of those rows point the other way and one points up: a second
// icon per direction would be four drawings of one idea.
export function IconArrow({ size = ICON_SIZE, dir = 'right' }) {
  const turn = { right: 0, left: 180, up: -90, down: 90 }[dir] || 0
  return (
    <svg {...iconStroke} width={size} height={size} style={turn ? { transform: `rotate(${turn}deg)` } : undefined}>
      <path d="M4 12h15" /><path d="m13 6 6 6-6 6" />
    </svg>
  )
}
// IconWarning — a caveat, not an error. The import screens print one beside a row
// the parser could read but not vouch for, and printed it as `⚠`, which renders
// as a full-colour emoji on most platforms and as a hollow outline on the rest —
// two pictures of one thing, and neither of them the app's.
export function IconWarning({ size = ICON_SIZE }) {
  return <svg {...iconStroke} width={size} height={size}><path d="M12 4.2 21 19.5H3z" /><path d="M12 10v4" /><path d="M12 16.6v.1" /></svg>
}
export function IconMerge({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><path d="M5 3.5v3c0 3 2.5 5.5 5.5 5.5H19"/><path d="M5 20.5v-3c0-3 2.5-5.5 5.5-5.5"/><path d="m15.5 8.5 3.5 3.5-3.5 3.5"/></svg> }
// IconUsers — two people. The cast, and the admin user list, and "fill actors
// from cast" — all three are the same idea and now the same drawing.
export function IconUsers({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6"/><path d="M17 14.2a5.5 5.5 0 0 1 3.5 4.8"/></svg> }
export function IconPerson({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><circle cx="12" cy="8" r="3.6"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/></svg> }
// IconUserPlus — add an account (admin only, on Profile and in Settings).
export function IconUserPlus({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><circle cx="10" cy="8" r="3.4"/><path d="M3.5 19.5a6.5 6.5 0 0 1 10.7-4.4"/><path d="M18 14.5v6"/><path d="M15 17.5h6"/></svg> }
// IconSwitchUser — a person, and the swap that replaces them. Sign in as someone
// else on this server; it is not logging out, and it should not look like it.
export function IconSwitchUser({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><circle cx="8.5" cy="7.5" r="3.2"/><path d="M3 18.5a5.5 5.5 0 0 1 9-4.2"/><path d="M14 16.5h6.5"/><path d="m18 14 2.5 2.5L18 19"/></svg> }
// IconLogout — through the door and out. Ends this browser session only, which
// is why the door stays and only the figure's arrow leaves.
export function IconLogout({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10"/><path d="M9.5 12h10"/><path d="m16 8.5 3.5 3.5-3.5 3.5"/></svg> }
// IconKey — the password field, and only ever a password. It is the same key on
// the profile form and in the backup copy, deliberately: an archive is opened by
// the password that sealed it, and the repeated glyph is part of saying so.
export function IconKey({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><circle cx="8" cy="12" r="4"/><path d="M12 12h8.5"/><path d="M17 12v3.5"/><path d="M20.5 12v2.5"/></svg> }
// IconDevice — a paired phone (Settings' Devices card).
export function IconDevice({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg> }
// IconArchive — a lidded box: one dated, encrypted backup.
export function IconArchive({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><rect x="3" y="4.5" width="18" height="4" rx="1.2"/><path d="M4.8 8.5v10a2 2 0 0 0 2 2h10.4a2 2 0 0 0 2-2v-10"/><path d="M10 12.5h4"/></svg> }
// IconRestore — the same box, opened upward. Restoring reads OUT of an archive,
// so the arrow leaves the box rather than entering it.
export function IconRestore({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><rect x="3" y="4.5" width="18" height="4" rx="1.2"/><path d="M4.8 8.5v10a2 2 0 0 0 2 2h10.4a2 2 0 0 0 2-2v-10"/><path d="M12 18v-6"/><path d="m9.3 14.7 2.7-2.7 2.7 2.7"/></svg> }
// IconRefresh — do it again against the live sources: re-verify, look up, refetch
// links, check for updates, start the tour over.
// A framed picture, for the control that attaches one. The mountain-and-sun
// shape is what every photo picker in the world uses, which is the whole reason
// to draw it rather than reuse the refresh arrow this control used to wear — an
// arrow says "fetch again" and the thing it opens is "choose a picture".
export function IconPicture({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="8.8" cy="9.6" r="1.6"/><path d="m4.5 17 4.6-4.6a1.6 1.6 0 0 1 2.3 0l3 3"/><path d="m13.7 14.2 1.9-1.9a1.6 1.6 0 0 1 2.3 0l2.1 2.1"/></svg> }

export function IconRefresh({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><path d="M20.5 12a8.5 8.5 0 1 1-2.9-6.4"/><path d="M20.5 3.5V9.2h-5.7"/></svg> }
// IconTour — a pennant on a pole: the guided tour, whether it is being started
// for the first time, replayed, or resumed. A flag rather than a circular arrow,
// because IconRefresh beside it in the same row means the narrower thing — from
// the beginning — and two ways of saying "the tour" would leave neither saying
// which.
export function IconTour({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><path d="M6 21V3.5"/><path d="M6 4.5h11.5l-2.6 3.8 2.6 3.8H6"/></svg> }
// IconBookmark — one place inside something longer. It opens the picker that
// replays a SINGLE tour step, which is the whole difference between it and the
// flag it sits beside.
export function IconBookmark({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><path d="M6.5 3.5h11v17l-5.5-4.2-5.5 4.2z"/></svg> }
// IconType — a serifed capital T: the Type panel, where every face the app uses
// is chosen. A letterform rather than a slider or a page, because the subject is
// the drawing of the letters themselves and nothing else on this screen is.
export function IconType({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><path d="M4 7V4.5h16V7"/><path d="M12 4.5v15"/><path d="M8.5 19.5h7"/></svg> }
// IconLanguages — a letterform from one script and a letterform from another,
// which is the language-marks panel's whole subject: what a proverb wears where
// every other quote wears a face. Deliberately NOT a globe or a flag — a flag is
// a country and a language is not, and that decision is the reason the panel
// exists (see LanguageMarksSettings).
export function IconLanguages({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><path d="M2.5 5.5h8.5"/><path d="M6.8 3.5v2"/><path d="M9 5.5c0 3.7-2.4 6.8-6.5 8.3"/><path d="M4.4 8.9c1.1 2.3 3 4 5.4 4.9"/><path d="m12.8 20.5 4.6-10.5 4.6 10.5"/><path d="M14.4 16.8h6"/></svg> }
// IconMoveTo — send the selection somewhere else (staging's "move to…", which
// re-parents quotes onto the right book or film).
export function IconMoveTo({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><path d="M3.5 12h11"/><path d="m10.5 8 4 4-4 4"/><path d="M19 4.5v15"/></svg> }
// IconRuler — a locator, measured. Staging's "locations…" rewrites Kindle
// location numbers across a batch by formula, so the glyph is a scale, not a pin.
export function IconRuler({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><rect x="2.5" y="9" width="19" height="6" rx="1.5"/><path d="M6.8 9v2.6"/><path d="M10.6 9v3.8"/><path d="M14.4 9v2.6"/><path d="M18.2 9v3.8"/></svg> }
// IconTag — one label on a string. Shared by the Tags tab and every tag control.
export function IconTag({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><path d="M4 12.7V5.5A1.5 1.5 0 0 1 5.5 4h7.2a2 2 0 0 1 1.4.6l6 6a1.8 1.8 0 0 1 0 2.5l-6.4 6.4a1.8 1.8 0 0 1-2.5 0l-6-6a2 2 0 0 1-.6-1.4Z"/><circle cx="8.8" cy="8.8" r="1.2"/></svg> }
// IconBooks — spines on a shelf, and NOT the open book IconReading draws. The
// Library tab and the "you are reading this" cover badge were the same picture
// meaning two different things, on screens that show both at once.
export function IconBooks({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><path d="M4 4.5h3.5v15H4z"/><path d="M8.8 4.5h3.5v15H8.8z"/><path d="m14.2 5.4 3.4-.9 3.9 14.5-3.4.9z"/></svg> }
// IconHighlight — a highlight taken out of a book: a page, and a marker's nib
// drawn across it. An annotation is the book side of a saved line, and it is one
// of the two search scopes with no tab of its own to borrow a glyph from.
//
// NOT a page with three lines of text. That is IconDetails, and a record card
// with a line count is what Details means; the nib is what makes this one about
// MARKING a page rather than reading one.
export function IconHighlight({ size = ICON_SIZE }) {
  return (
    <svg {...iconStroke} width={size} height={size}>
      <path d="M5 5.5A2 2 0 0 1 7 3.5h6.5a2 2 0 0 1 2 2v2.2"/>
      <path d="M5 5.5v13a2 2 0 0 0 2 2h3.4"/>
      <path d="M8.5 8.6h4"/>
      <path d="m19.9 8.5-7.7 7.7-3.3 1 1-3.3 7.7-7.7a1.6 1.6 0 0 1 2.3 2.3Z"/>
    </svg>
  )
}
// IconDialogue — two bubbles, because a dialogue is two people. The film side of
// a saved line, and told apart from IconQuote by the COUNT rather than by any
// detail: one bubble carrying filled quote marks is a quotation, two bubbles are
// an exchange. They never appear meaning the same thing — the search scope row is
// the one place both are on screen at once, and there they are the two things
// they look like.
export function IconDialogue({ size = ICON_SIZE }) {
  return (
    <svg {...iconStroke} width={size} height={size}>
      <path d="M3.5 6.5A2 2 0 0 1 5.5 4.5h6a2 2 0 0 1 2 2V9a2 2 0 0 1-2 2H7l-3.5 2.5V11z"/>
      <path d="M16 10.5h2.5a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H17l-3.5 2.5V17h-1a2 2 0 0 1-2-2v-.6"/>
    </svg>
  )
}
// IconReel — the Catalogue's film reel, salvaged from the retired cover-size
// slider.
export function IconReel({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="6.4" r="1"/><circle cx="17.6" cy="12" r="1"/><circle cx="12" cy="17.6" r="1"/><circle cx="6.4" cy="12" r="1"/></svg> }
export function IconHome({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="6.1 2.1 243.9 243.9" width={size} height={size}><path d="M224,120v96a8,8,0,0,1-8,8H160a8,8,0,0,1-8-8V164a4,4,0,0,0-4-4H108a4,4,0,0,0-4,4v52a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V120a16,16,0,0,1,4.69-11.31l80-80a16,16,0,0,1,22.62,0l80,80A16,16,0,0,1,224,120Z"/></svg> }
// IconRecords — stacked cards: the Metadata console, which is every row you have
// seen from behind.
export function IconRecords({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="1.2 1.2 253.7 253.7" width={size} height={size}><path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM176,168H80a8,8,0,0,1,0-16h96a8,8,0,0,1,0,16Zm0-32H80a8,8,0,0,1,0-16h96a8,8,0,0,1,0,16Zm0-32H80a8,8,0,0,1,0-16h96a8,8,0,0,1,0,16Z"/></svg> }
export function IconStats({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="1.2 -2.8 253.7 253.7" width={size} height={size}><path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1,0-16h8V136a8,8,0,0,1,8-8H72a8,8,0,0,1,8,8v64H96V88a8,8,0,0,1,8-8h32a8,8,0,0,1,8,8V200h16V40a8,8,0,0,1,8-8h40a8,8,0,0,1,8,8V200h8A8,8,0,0,1,232,208Z"/></svg> }
export function IconSliders({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="0.4 0.4 255.3 255.3" width={size} height={size}><path d="M216,130.16q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.6,107.6,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.29,107.29,0,0,0-26.25-10.86,8,8,0,0,0-7.06,1.48L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.6,107.6,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z"/></svg> }
// IconImport — into the tray, where IconExport goes down onto a floor. Both are
// down arrows because that is the convention everywhere; what differs is whether
// the arrow arrives somewhere or leaves.
export function IconImport({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="10.9 10.9 234.1 234.1" width={size} height={size}><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM90.34,114.34a8,8,0,0,1,11.32,0L120,132.69V72a8,8,0,0,1,16,0v60.69l18.34-18.35a8,8,0,0,1,11.32,11.32l-32,32a8,8,0,0,1-11.32,0l-32-32A8,8,0,0,1,90.34,114.34ZM208,208H48V168H76.69L96,187.32A15.89,15.89,0,0,0,107.31,192h41.38A15.86,15.86,0,0,0,160,187.31L179.31,168H208v40Z"/></svg> }

// ---- what a selection can do, as pictures (1.12.0) ------------------------
//
// The selection bar was a row of words and is a row of glyphs. Five of the things
// it offers had no drawing yet; the rest were already here and are reused rather
// than redrawn — IconMetadata fills the gaps, IconMoveTo moves a shelf, IconTag
// adds tags, IconEdit edits the one, IconDetails sets fields, IconDelete deletes
// the lot. Reuse is the point: a glyph that means "fetch metadata" on the console
// must mean the same thing in a bar.

// IconHeart — favourite. The card has drawn a heart since the beginning; this is
// that mark promoted into the set, so the bar and the card cannot end up with two.
export function IconHeart({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><path d="M12 20.2c-1.6-1.2-7.5-5-7.5-9.9A4 4 0 0 1 12 8.1a4 4 0 0 1 7.5 2.2c0 4.9-5.9 8.7-7.5 9.9Z"/></svg> }
// IconPalette — set the colour category. A drop of ink rather than an artist's
// palette, because the control it opens is six coloured dots and the glyph should
// promise the same thing it delivers.
export function IconPalette({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="1.2 -2.8 253.7 253.7" width={size} height={size}><path d="M200.77,53.89A103.27,103.27,0,0,0,128,24h-1.07A104,104,0,0,0,24,128c0,43,26.58,79.06,69.36,94.17A32,32,0,0,0,136,192a16,16,0,0,1,16-16h46.21a31.81,31.81,0,0,0,31.2-24.88,104.43,104.43,0,0,0,2.59-24A103.28,103.28,0,0,0,200.77,53.89ZM84,168a12,12,0,1,1,12-12A12,12,0,0,1,84,168Zm0-56a12,12,0,1,1,12-12A12,12,0,0,1,84,112Zm44-24a12,12,0,1,1,12-12A12,12,0,0,1,128,88Zm44,24a12,12,0,1,1,12-12A12,12,0,0,1,172,112Z"/></svg> }
// IconQuiz / IconQuizSkip — in the Daily Quiz and out of it, and A PAIR ON
// PURPOSE. This is one button whose label flips: it reads "Skip in quiz" over a
// selection that is in and "Add to quiz" over one that is out. A single glyph for
// both would leave the state unreadable the moment the words came off, which is
// exactly what turning the bar into icons does. So the picture flips too.
//
// A flash card, because that is what the quiz puts in front of you.
// IconShuffle — the two crossing arrows every player uses for shuffle. Drawn
// rather than borrowed from IconReel or IconQuiz: this opens a surface that has
// nothing to do with the review loop, and sharing a glyph with the deck would
// say the opposite of what the feature is for.
export function IconShuffle({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><path d="M3 7h3.5l3 4"/><path d="M14.5 16H18"/><path d="M3 17h3.5l7-10H18"/><path d="M16 5l2.5 2L16 9"/><path d="M16 14l2.5 2L16 18"/></svg> }

export function IconQuiz({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><rect x="4" y="5" width="16" height="14" rx="2.5"/><path d="M9.9 10.2a2.2 2.2 0 1 1 2.7 2.1c-.42.13-.63.42-.63.85v.5"/><path d="M11.97 16.1v.01"/></svg> }
export function IconQuizSkip({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><rect x="4" y="5" width="16" height="14" rx="2.5"/><path d="m6.6 17.4 10.8-10.8"/></svg> }
// IconSeal — one sticker across a whole selection. A medal rather than a sticker
// sheet: the act is SEALING a set of quotes with a single mark, and a sheet would
// promise a choice per card.
export function IconSeal({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><circle cx="12" cy="9.2" r="5.7"/><path d="m8.4 14.2-1.4 6.3 5-2.8 5 2.8-1.4-6.3"/></svg> }
// IconAnthology — three lines held together by a brace. Not a book and not a
// page: an anthology owns no words of its own, it GATHERS lines that already live
// somewhere else, and the brace is the one mark in typography whose whole meaning
// is "these, taken together". A stack of pages would have read as a document,
// which is what the export is, and an open book would have been the Library tab
// at a different angle.
export function IconAnthology({ size = ICON_SIZE }) { return <svg {...iconStroke} width={size} height={size}><path d="M9.8 5h9.4"/><path d="M9.8 12h9.4"/><path d="M9.8 19h9.4"/><path d="M7 5c-1.3 0-1.3 6-2.5 7 1.2 1 1.2 7 2.5 7"/></svg> }

// The Library. IconBooks keeps the outline for the shelf and the search result — a
// book you can act on, rather than the place they live.
// IconChecks — the rail's Checks row. A page with a pencil on it: the screen is a
// list of things somebody has to look over, which is what "a note being marked up"
// means and what neither a tick nor a tray would say. Phosphor `note-pencil`, fill.
export function IconChecks({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="10.0 2.0 243.9 243.9" width={size} height={size}><path d="M224,128v80a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32h80a8,8,0,0,1,0,16H48V208H208V128a8,8,0,0,1,16,0Zm5.66-58.34-96,96A8,8,0,0,1,128,168H96a8,8,0,0,1-8-8V128a8,8,0,0,1,2.34-5.66l96-96a8,8,0,0,1,11.32,0l32,32A8,8,0,0,1,229.66,69.66Zm-17-5.66L192,43.31,179.31,56,200,76.69Z"/></svg> }
// IconBin — the rail's Bin row, filled because it names a PLACE there. IconDelete
// stays an outline: it is the VERB, on every row that can destroy something, and the
// two must not be one drawing or a row's delete button would read as a destination.
export function IconBin({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="1.2 -6.8 253.7 253.7" width={size} height={size}><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM112,168a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm0-120H96V40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8Z"/></svg> }
export function IconNavLibrary({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="14.1 2.1 243.9 243.9" width={size} height={size}><path d="M231.65,194.55,198.46,36.75a16,16,0,0,0-19-12.39L132.65,34.42a16.08,16.08,0,0,0-12.3,19l33.19,157.8A16,16,0,0,0,169.16,224a16.25,16.25,0,0,0,3.38-.36l46.81-10.06A16.09,16.09,0,0,0,231.65,194.55ZM136,50.15c0-.06,0-.09,0-.09l46.8-10,3.33,15.87L139.33,66Zm10,47.38-3.35-15.9,46.82-10.06,3.34,15.9Zm70,100.41-46.8,10-3.33-15.87L212.67,182,216,197.85C216,197.91,216,197.94,216,197.94ZM104,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V48A16,16,0,0,0,104,32ZM56,48h48V64H56Zm48,160H56V192h48v16Z"/></svg> }
// The Catalogue. IconReel keeps the outline where a film is the subject rather than
// the destination.
export function IconNavCatalogue({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="0.3 -3.7 263.4 263.4" width={size} height={size}><path d="M232,216H183.36A103.95,103.95,0,1,0,128,232H232a8,8,0,0,0,0-16ZM80,148a20,20,0,1,1,20-20A20,20,0,0,1,80,148Zm48,48a20,20,0,1,1,20-20A20,20,0,0,1,128,196Zm0-96a20,20,0,1,1,20-20A20,20,0,0,1,128,100Zm28,28a20,20,0,1,1,20,20A20,20,0,0,1,156,128Z"/></svg> }
// The Quotes screen. IconQuote keeps the outline for the five places where a quote is
// the thing being acted on.
export function IconNavQuotes({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="1.2 5.2 253.7 253.7" width={size} height={size}><path d="M116,72v88a48.05,48.05,0,0,1-48,48,8,8,0,0,1,0-16,32,32,0,0,0,32-32v-8H40a16,16,0,0,1-16-16V72A16,16,0,0,1,40,56h60A16,16,0,0,1,116,72ZM216,56H156a16,16,0,0,0-16,16v64a16,16,0,0,0,16,16h60v8a32,32,0,0,1-32,32,8,8,0,0,0,0,16,48.05,48.05,0,0,0,48-48V72A16,16,0,0,0,216,56Z"/></svg> }
// Anthologies. Stacked sheets: a gathering of lines that live somewhere else.
export function IconNavAnthologies({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="-8.5 -8.6 273.2 273.2" width={size} height={size}><path d="M220,169.09l-92,53.65L36,169.09A8,8,0,0,0,28,182.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,169.09Z"/><path d="M220,121.09l-92,53.65L36,121.09A8,8,0,0,0,28,134.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,121.09Z"/><path d="M28,86.91l96,56a8,8,0,0,0,8.06,0l96-56a8,8,0,0,0,0-13.82l-96-56a8,8,0,0,0-8.06,0l-96,56a8,8,0,0,0,0,13.82Z"/></svg> }
// The Tags screen — the place that lists every tag. IconTag stays the label drawn on a
// card.
export function IconNavTags({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="8.3 8.3 263.4 263.4" width={size} height={size}><path d="M243.31,136,144,36.69A15.86,15.86,0,0,0,132.69,32H40a8,8,0,0,0-8,8v92.69A15.86,15.86,0,0,0,36.69,144L136,243.31a16,16,0,0,0,22.63,0l84.68-84.68a16,16,0,0,0,0-22.63ZM84,96A12,12,0,1,1,96,84,12,12,0,0,1,84,96Z"/></svg> }
// Search as a DESTINATION. IconSearch has thirteen other callers where it is the verb,
// and every one of them stays drawn.
export function IconNavSearch({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="1.1 1.1 253.7 253.7" width={size} height={size}><path d="M168,112a56,56,0,1,1-56-56A56,56,0,0,1,168,112Zm61.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88,88,0,1,1,11.32-11.31l50.06,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z"/></svg> }
// The account. A card with a face on it rather than the bare head IconPerson draws for
// a credit.
export function IconNavProfile({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="1.2 1.2 253.7 253.7" width={size} height={size}><path d="M112,120a16,16,0,1,1-16-16A16,16,0,0,1,112,120ZM232,56V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56ZM135.75,166a39.76,39.76,0,0,0-17.19-23.34,32,32,0,1,0-45.12,0A39.84,39.84,0,0,0,56.25,166a8,8,0,0,0,15.5,4c2.64-10.25,13.06-18,24.25-18s21.62,7.73,24.25,18a8,8,0,1,0,15.5-4ZM200,144a8,8,0,0,0-8-8H152a8,8,0,0,0,0,16h40A8,8,0,0,0,200,144Zm0-32a8,8,0,0,0-8-8H152a8,8,0,0,0,0,16h40A8,8,0,0,0,200,112Z"/></svg> }
// User management. IconUsers keeps the outline for its five non-nav callers.
export function IconNavUsers({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="-25.4 -25.4 306.8 306.8" width={size} height={size}><path d="M164.47,195.63a8,8,0,0,1-6.7,12.37H10.23a8,8,0,0,1-6.7-12.37,95.83,95.83,0,0,1,47.22-37.71,60,60,0,1,1,66.5,0A95.83,95.83,0,0,1,164.47,195.63Zm87.91-.15a95.87,95.87,0,0,0-47.13-37.56A60,60,0,0,0,144.7,54.59a4,4,0,0,0-1.33,6A75.83,75.83,0,0,1,147,150.53a4,4,0,0,0,1.07,5.53,112.32,112.32,0,0,1,29.85,30.83,23.92,23.92,0,0,1,3.65,16.47,4,4,0,0,0,3.95,4.64h60.3a8,8,0,0,0,7.73-5.93A8.22,8.22,0,0,0,252.38,195.48Z"/></svg> }
// THE FAVOURITE, SET. review.jsx already flipped the LABEL between on and off while
// drawing one icon, so the state lived in the words and nowhere else.
export function IconHeartOn({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="-8.6 -0.6 273.2 273.2" width={size} height={size}><path d="M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z"/></svg> }
// PRACTISE, AND IT IS NOT THE QUIZ CARD. Nine call sites read practise and drew
// IconQuiz, so the place you go to study and the card you are asked looked identical.
// A mortarboard is recognised by its outer shape, which is the whole of rule 3.
export function IconPractise({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="-28.1 -20.1 312.2 312.2" width={size} height={size}><path d="M176,207.24a119,119,0,0,0,16-7.73V240a8,8,0,0,1-16,0Zm11.76-88.43-56-29.87a8,8,0,0,0-7.52,14.12L171,128l17-9.06Zm64-29.87-120-64a8,8,0,0,0-7.52,0l-120,64a8,8,0,0,0,0,14.12L32,117.87v48.42a15.91,15.91,0,0,0,4.06,10.65C49.16,191.53,78.51,216,128,216a130,130,0,0,0,48-8.76V130.67L171,128l-43,22.93L43.83,106l0,0L25,96,128,41.07,231,96l-18.78,10-.06,0L188,118.94a8,8,0,0,1,4,6.93v73.64a115.63,115.63,0,0,0,27.94-22.57A15.91,15.91,0,0,0,224,166.29V117.87l27.76-14.81a8,8,0,0,0,0-14.12Z"/></svg> }
// A GAME UNDERWAY. ReadingBadge computed isGame for its aria-label and then drew the
// film glyph, so a game announced itself as a game and looked like a film.
export function IconPlaying({ size = ICON_SIZE }) { return <svg {...iconFill} viewBox="-18.3 -18.3 292.6 292.6" width={size} height={size}><path d="M247.44,173.75a.68.68,0,0,0,0-.14L231.05,89.44c0-.06,0-.12,0-.18A60.08,60.08,0,0,0,172,40H83.89a59.88,59.88,0,0,0-59,49.52L8.58,173.61a.68.68,0,0,0,0,.14,36,36,0,0,0,60.9,31.71l.35-.37L109.52,160h37l39.71,45.09c.11.13.23.25.35.37A36.08,36.08,0,0,0,212,216a36,36,0,0,0,35.43-42.25ZM104,112H96v8a8,8,0,0,1-16,0v-8H72a8,8,0,0,1,0-16h8V88a8,8,0,0,1,16,0v8h8a8,8,0,0,1,0,16Zm40-8a8,8,0,0,1,8-8h24a8,8,0,0,1,0,16H152A8,8,0,0,1,144,104Zm84.37,87.47a19.84,19.84,0,0,1-12.9,8.23A20.09,20.09,0,0,1,198,194.31L167.8,160H172a60,60,0,0,0,51-28.38l8.74,45A19.82,19.82,0,0,1,228.37,191.47Z"/></svg> }


// The filled set renders itself into the glossary. A picture of a glyph can go stale;
// the glyph cannot. Guarded like every other declaration — see the note beside the
// first ones — so none of this reaches the shipped bundle.
if (import.meta.env.DEV) {
  IconHeartOn.glossary = { demo: (h) => h(IconHeartOn, { size: 28 }) };
  IconHome.glossary = { demo: (h) => h(IconHome, { size: 28 }) };
  IconNavLibrary.glossary = { demo: (h) => h(IconNavLibrary, { size: 28 }) };
  IconNavCatalogue.glossary = { demo: (h) => h(IconNavCatalogue, { size: 28 }) };
  IconNavQuotes.glossary = { demo: (h) => h(IconNavQuotes, { size: 28 }) };
  IconNavAnthologies.glossary = { demo: (h) => h(IconNavAnthologies, { size: 28 }) };
  IconNavTags.glossary = { demo: (h) => h(IconNavTags, { size: 28 }) };
  IconRecords.glossary = { demo: (h) => h(IconRecords, { size: 28 }) };
  IconStats.glossary = { demo: (h) => h(IconStats, { size: 28 }) };
  IconSliders.glossary = { demo: (h) => h(IconSliders, { size: 28 }) };
  IconNavSearch.glossary = { demo: (h) => h(IconNavSearch, { size: 28 }) };
  IconImport.glossary = { demo: (h) => h(IconImport, { size: 28 }) };
  IconNavProfile.glossary = { demo: (h) => h(IconNavProfile, { size: 28 }) };
  IconNavUsers.glossary = { demo: (h) => h(IconNavUsers, { size: 28 }) };
  IconPractise.glossary = { demo: (h) => h(IconPractise, { size: 28 }) };
  IconPalette.glossary = { demo: (h) => h(IconPalette, { size: 28 }) };
  IconReading.glossary = { demo: (h) => h(IconReading, { size: 28 }) };
  IconWatching.glossary = { demo: (h) => h(IconWatching, { size: 28 }) };
  IconPlaying.glossary = { demo: (h) => h(IconPlaying, { size: 28 }) };
}

// NavIcon — the glyph for a nav tab, keyed by the tab key the four lists in
// routes.js use.
//
// EVERY CASE HERE DRAWS A FILL, and five of them look unchanged because they did not
// need a second glyph: IconHome, IconRecords, IconImport, IconStats and IconSliders
// had no caller outside this switch, so their own drawing became the filled one. The
// other eight are used elsewhere as verbs — IconSearch alone has thirteen such call
// sites — and a verb must not wear the fill that means "somewhere to go", so those
// have a separate IconNav* twin and keep their outline everywhere else.
//
// It lived in App.jsx as `TabIcon` with its own stroke settings, which is how
// the app came to draw a magnifier, an open book and a tray-download twice each
// — once here at strokeWidth 2.0 and once in the shared set at 1.85 — and to
// draw the Library tab and the "currently reading" badge identically. The nav is
// not a special case; it is the most-looked-at instance of the same vocabulary.
// So there is one set now, one weight, and every drawing has one meaning.
//
// Returning null for an unknown key is deliberate: a tab added to a nav list and
// not to this switch should render a bare label, not crash the shell.
export function NavIcon({ name }) {
  switch (name) {
    case 'home': return <IconHome />
    case 'quotes': return <IconNavQuotes />
    case 'anthologies': return <IconNavAnthologies />
    case 'library': return <IconNavLibrary />
    case 'movies': return <IconNavCatalogue />
    // A SHOW AND A GAME REUSE THE PICTURES THE APP ALREADY HAS, and the icon
    // suite is why: a monitor-play glyph and a controller were added here as
    // IconNavShow/IconNavGame and came back as exact duplicates of IconWatching
    // and IconPlaying. Two pictures of one thing is the defect the test exists
    // for — and the reuse is not a compromise, it is the better reading: a show
    // is the thing you watch and a game the thing you play, which is what those
    // two glyphs have always meant.
    case 'show': return <IconWatching />
    case 'game': return <IconPlaying />
    case 'metadata': return <IconRecords />
    case 'import': return <IconImport />
    case 'search': return <IconNavSearch />
    case 'tags': return <IconNavTags />
    case 'stats': return <IconStats />
    case 'settings': return <IconSliders />
    case 'profile': return <IconNavProfile />
    case 'users': return <IconNavUsers />
    default: return null
  }
}

// ---- metadata-source marks ----
// A look-up row shows WHERE a match came from. It used to be a "GOOGLE BOOKS"
// text pill, which on a phone cost ~90px of a ~256px row and truncated the title
// to nothing. These are 16px category glyphs (not brand logos — they match the
// hand-drawn stroke set and need no licensing); the source's real name rides the
// tooltip and the aria-label, so nothing is lost to a pointer or a screen reader.
const srcStroke = { ...iconStroke, width: 16, height: 16 }

function IconSrcGoogle() { return <svg {...srcStroke}><path d="M12 6.6C10 5.1 7 4.8 4 5.3v12.4c3-.5 6-.2 8 1.3 2-1.5 5-1.8 8-1.3V5.3c-3-.5-6-.2-8 1.3Z"/><path d="M12 6.6V19"/></svg> }
function IconSrcOpenLibrary() { return <svg {...srcStroke}><path d="M3.5 20h17"/><path d="M6 17V8"/><path d="M10 17V6"/><path d="M14 17V9"/><path d="M18 17V7"/></svg> }
function IconSrcAmazon() { return <svg {...srcStroke}><path d="M3.5 8 12 4l8.5 4-8.5 4z"/><path d="M3.5 8v8l8.5 4 8.5-4V8"/></svg> }
function IconSrcTMDB() { return <svg {...srcStroke}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14"/><path d="M17 5v14"/><path d="M3 12h18"/></svg> }
function IconSrcTVDB() { return <svg {...srcStroke}><rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="m8 3.5 4 4 4-4"/></svg> }
// IGDB HAD NO MARK, and a game match drew the question mark below instead. Games
// arrive through the same lookup as films — a candidate carries `source: "igdb"` —
// so the one supplier whose matches are always games was the one the picker could
// not name. A pad, because that is what the medium is played on.
function IconSrcIGDB() { return <svg {...srcStroke}><rect x="2.5" y="7.5" width="19" height="11" rx="4.5"/><path d="M7 11v4"/><path d="M5 13h4"/><path d="M15.5 12.5v.01"/><path d="M18 14.5v.01"/></svg> }
function IconSrcUnknown() { return <svg {...srcStroke}><circle cx="12" cy="12" r="8.5"/><path d="M12 16.5v.01"/><path d="M12 13.5v-1a2.5 2.5 0 1 0-2.5-2.5"/></svg> }

// SOURCE_META — slug → {name, Icon}. Slugs mirror the Go side exactly:
// metadata.BookCandidate.Source is "google" | "openlibrary" | "amazon";
// movie candidates carry "tmdb" | "tvdb" | "igdb" — a game is looked up through the
// same endpoint as a film, so all three appear on one picker.
// `name` holds a key. The values are proper nouns and are marked DO NOT
// TRANSLATE in the locale file — keying them is what makes that a property of the
// string rather than a hope about whoever opens the file.
export const SOURCE_META = {
  google: { name: "vocab.source.google.label", Icon: IconSrcGoogle },
  openlibrary: { name: "vocab.source.openlibrary.label", Icon: IconSrcOpenLibrary },
  amazon: { name: "vocab.source.amazon.label", Icon: IconSrcAmazon },
  tmdb: { name: "vocab.source.tmdb.label", Icon: IconSrcTMDB },
  tvdb: { name: "vocab.source.tvdb.label", Icon: IconSrcTVDB },
  igdb: { name: "vocab.source.igdb.label", Icon: IconSrcIGDB },
};

if (import.meta.env.DEV) {
  FieldSourceTag.glossary = {
    demo: (h) =>
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 420 } },
        [
          ["page count", "google", "2026-02-14"],
          ["description", "manual", null],
          ["series", null, null],
        ].map(([label, source, at]) =>
          h(
            "div",
            { key: label, style: { display: "flex", alignItems: "center", gap: 8 } },
            h(MonoLabel, null, label),
            h("span", { style: { flex: 1 } }),
            h(FieldSourceTag, { source, at }),
          ),
        ),
      ),
  };
}

// SOURCE_KEYS / sourceName — the reader's name for a supplier, in ONE place.
//
// It lived in CoverPicker.jsx, which was right while a supplier was only ever named on a
// cover candidate. Per-field provenance names one on every field row, and a second table
// is how a picker and a field row come to call one company two things.
//
// KEYS, NOT SPELLINGS, and the list is the store's: `field_source.source` can hold any of
// these (internal/httpapi/reverify_handlers.go's knownBookSource / knownMovieSource), so
// three that the cover picker never sees — imdb, wikipedia and `manual` — are here too.
const SOURCE_KEYS = {
  tvdb: "vocab.source.tvdb.label",
  tmdb: "vocab.source.tmdb.label",
  igdb: "vocab.source.igdb.label",
  wikidata: "vocab.source.wikidata.label",
  google: "vocab.source.google.label",
  openlibrary: "vocab.source.openlibrary.label",
  amazon: "vocab.source.amazon.label",
  wikimedia: "vocab.source.wikimedia.label",
  fandom: "vocab.source.fandom.label",
  letterboxd: "vocab.source.letterboxd.label",
  imdb: "vocab.source.imdb.label",
  wikipedia: "vocab.source.wikipedia.label",
  // Not a supplier. `manual` is the store's word for "somebody looked at this and
  // decided", which it treats as a real answer rather than the absence of one.
  manual: "vocab.source.manual.label",
};

// An unknown slug falls through to itself rather than to a missing key.
export const sourceName = (slug) =>
  SOURCE_KEYS[slug] ? t(SOURCE_KEYS[slug]) : String(slug || "");

// ProviderMark — a supplier's own mark, drawn as a mask so it wears the row's ink.
//
// IT REPLACES A CATEGORY GLYPH, AND THAT REVERSES A DECISION written a few lines above:
// "these are 16px category glyphs (not brand logos — they match the hand-drawn stroke set
// and need no licensing)". That held while a supplier's name appeared once, on a look-up
// row you were already reading. It stops holding now that every FIELD on a record carries
// the mark of whoever wrote it: at that density the reader is scanning for "which of
// these did Google write", and a category glyph cannot answer it — five of the twelve
// suppliers shared one drawing. A real mark is recognised without being read, which is
// the job. The licensing that note avoided is the price, paid in docs/PROVIDER-MARKS.md.
//
// A SLUG WITH NO MARK IS NOT AN ERROR. `manual` has no supplier to draw, and a supplier
// added tomorrow has no mark until somebody adds one; both fall back to the name.
export function ProviderMark({ source, size }) {
  const uri = PROVIDER_MARKS[source];
  if (!uri) return null;
  return (
    <span
      className="src-mark"
      aria-hidden="true"
      style={{
        WebkitMaskImage: `url("${uri}")`,
        maskImage: `url("${uri}")`,
        ...(size ? { width: size, height: size } : null),
      }}
    />
  );
}

// FieldSourceTag — who wrote this field, on the row that field lives in.
//
// WHY PER FIELD AND NOT PER RECORD. A record is assembled: the ISBN came from the scan,
// the page count from Google Books because Open Library had the wrong edition, the
// description you wrote. One provenance line for eleven fields cannot say that, and it
// makes Refetch an all-or-nothing gamble — which is why people stop pressing it.
//
// THREE STATES, AND THEY ARE GENUINELY DIFFERENT. A supplier's mark means that supplier
// wrote it. The accent word means YOU did — `store.SourceManual`, which the database
// treats as a real answer. NOTHING AT ALL means the field has no row, which is "we do not
// know" and is not the same as "nobody has touched it".
//
// `note` is a fourth thing a source can be, and only the cast list has it: a row
// SEEDED by a supplier and then corrected by the reader, which the schema keeps as
// its own origin because a refetch may rewrite the supplier's own facts on it and
// may never touch the two names. The mark stays the supplier's — that is where the
// row came from — and the note says what happened to it since. It reaches the
// tooltip and the screen reader, not the row, because a cast list is twenty rows
// and a word repeated on each is a word nobody reads.
//
// `onOpen` IS THE DOOR, and it is handoff §1.2's last clause: "tapping it opens
// that field's candidates with the value each source is offering, side by side".
// A tag with one becomes a button and says so; a tag without one is the span it
// has always been, because most tags — a cast row's twenty of them, a credit on
// a work with nothing pinned — have nothing behind them and a button that opens
// an empty panel is worse than a label.
export function FieldSourceTag({ source, at, note, onOpen, openLabel, disabled = false }) {
  if (!source) return null;
  const name = sourceName(source);
  const when = at ? ` · ${String(at).slice(0, 10)}` : "";
  const said = note ? `${name} · ${note}` : name;
  const drawn = !!PROVIDER_MARKS[source];
  const inside = (
    <>
      <ProviderMark source={source} />
      {drawn ? null : <span aria-hidden="true">{name}</span>}
      <span className="sr-only">{said}</span>
    </>
  );
  const data = drawn ? source : source === "manual" ? "manual" : "none";
  if (!onOpen) {
    return (
      <span className="field-src" data-src={data} title={`${said}${when}`}>
        {inside}
      </span>
    );
  }
  const does = openLabel || t("common.field.source.open.tip");
  return (
    <button
      type="button"
      className="field-src is-door tactile"
      data-src={data}
      // The tooltip says what pressing it does, because the mark alone reads as
      // a label and a label is not something anybody tries to press.
      title={`${does} — ${said}${when}`}
      // AND SO DOES THE ACCESSIBLE NAME. The mark is decorative and the only
      // text inside is the sr-only supplier, so without this a screen reader
      // announced "Google Books, button" — indistinguishable from the label this
      // must not be mistaken for. A tooltip is not an accessible name, and every
      // FieldIconButton beside it carries an explicit one.
      aria-label={`${does} — ${said}`}
      // A TAKE DURING A MASTER SAVE is two writers on one record: the panel's ✓
      // is collecting every open row while this would rewrite one field from a
      // supplier. The pencil two lines below has always been gated on the same
      // flag; the tag was not, because it was not pressable.
      disabled={!!disabled}
      onClick={onOpen}
    >
      {inside}
    </button>
  );
}

// SourceIcon — the pill replacement, labelled the way InfoDot is: a tooltip for
// a pointer and a real aria-label for assistive tech. `detail` appends the
// supplier's id ("TMDB · #603") to the label without costing any row width.
export function SourceIcon({ source, detail, side = "top" }) {
  const meta = SOURCE_META[source];
  const Icon = meta ? meta.Icon : IconSrcUnknown;
  const name = meta ? t(meta.name) : source || t("vocab.source.unknown.label");
  const label = detail ? t("common.source.detail.tip", { name, detail }) : name;
  return (
    <Tooltip label={label} side={side}>
      <span tabIndex={0} className="src-mark" aria-label={t("common.source.aria", { name: label })}>
        <Icon />
      </span>
    </Tooltip>
  );
}

// MoreMenu — a small overflow dropdown for actions that don't fit a mobile
// detail bar (export/edit/delete). Opens below the "⋯" trigger; closes on
// outside click or item pick. `items` is [{icon, label, onClick, danger}].
// ActionMenu — the menu itself, with no opinion about what opened it.
//
// ONE MENU, THREE TRIGGERS. The ⋯ button on a card row opens it anchored to
// itself; a right-click or a long-press opens it at the POINT the pointer was;
// Shift+F10 and the Menu key open it anchored to the card. Writing a second menu
// for the second trigger is how an app ends up with two menus that offer slightly
// different things — which is the whole argument actions.jsx makes one file over.
//
// `items` is [{ id, label, icon, danger, onClick }] — what the registry produces,
// with `run` mapped to `onClick` by the caller.
//
// KEYBOARD BEHAVIOUR IS WHAT MAKES IT A MENU rather than a dropdown: focus lands
// on the first item when it opens, arrows move, Home/End jump, Enter and Space
// activate (the items are real buttons, so that is free), Escape closes and focus
// goes back to whatever opened it. Without that, a keyboard user can open this and
// then only tab THROUGH it into the page behind.
export function ActionMenu({ open, items = [], anchorRef, at = null, onClose, returnFocusTo }) {
  const { popRef, style } = useAnchoredPosition(open, anchorRef, {
    // align 'end' when it hangs off a glyph at the right end of a row — opening
    // rightwards would need clamping immediately. A point-anchored menu opens
    // rightwards from the pointer, which is what every native menu does.
    align: at ? "start" : "end",
    minHeight: 100,
    at,
  })
  const close = onClose || (() => {})
  useDismiss(open, close, [popRef, ...(anchorRef ? [anchorRef] : [])], {
    onEscape: () => returnFocusTo?.current?.focus(),
  })

  // Focus the first item on open. In a layout effect rather than an effect so it
  // happens before the browser paints — a menu that appears and then steals focus
  // a frame later is a menu that can lose a keystroke typed in between.
  useLayoutEffect(() => {
    if (!open) return
    // ^= , not = : a choice row is a menuitemradio, and a selector that named only
    // menuitem would step straight over every "which view am I in" row — the arrow
    // keys would skip exactly the part of the menu that is a choice.
    popRef.current?.querySelector("[role^=menuitem]")?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  // Arrow keys move within the menu, wrapping, and Home/End jump. Read off the DOM
  // rather than an index in state: the items ARE the source of truth for order, and
  // an index would have to be kept in step with a list that a screen can change
  // while the menu is open.
  const onKeyDown = (e) => {
    const all = [...(popRef.current?.querySelectorAll("[role^=menuitem]") || [])]
    if (!all.length) return
    const here = all.indexOf(document.activeElement)
    const go = (i) => {
      e.preventDefault()
      all[(i + all.length) % all.length].focus()
    }
    if (e.key === "ArrowDown") return go(here + 1)
    if (e.key === "ArrowUp") return go(here - 1)
    if (e.key === "Home") return go(0)
    if (e.key === "End") return go(all.length - 1)
    if (e.key === "Tab") {
      // A menu is a mode. Tabbing out of it is a way to leave it open behind you,
      // with focus in the page and a floating panel nobody can see the state of.
      e.preventDefault()
      close()
      returnFocusTo?.current?.focus()
    }
  }

  return createPortal(
    <div
      ref={popRef}
      className="hand-card hc-r2 more-menu"
      role="menu"
      style={style}
      onKeyDown={onKeyDown}
    >
      {/* The key carries the index as well as the id: a composed page concatenates
          two sections' items and both are entitled to their own "h-do" heading, so
          ids are unique within a builder and not across them. */}
      {items.map((it, i) =>
        // A HEADING IS NOT AN ITEM. It carries no role, takes no focus and is
        // skipped by the arrow keys for free, because the key handler above reads
        // `[role^=menuitem]` off the DOM rather than counting the array. Added for
        // the screen menu, which is a menu BAR — a dozen rows in four groups, where
        // an unbroken list of twelve is a list nobody reads to the end of.
        it.heading ? (
          <div key={`${it.id || 'h'}-${i}`} className="menu-head" aria-hidden="true">
            {it.heading}
          </div>
        ) : (
        <button
          key={`${it.id || 'i'}-${i}`}
          type="button"
          role="menuitem"
          className="menu-item"
          // A ROW THAT IS A CHOICE SAYS SO TO A SCREEN READER TOO. `checked` makes
          // it a menuitemradio, which is what "one of these is the current view" is
          // — a plain menuitem with a tick drawn on it announces nothing.
          {...(it.checked == null ? {} : { role: "menuitemradio", "aria-checked": !!it.checked })}
          style={it.danger ? { color: "var(--error)" } : undefined}
          // The menu is in a portal, so it is nowhere near the card in the DOM —
          // but a React event travels the COMPONENT tree, not the DOM tree, and
          // reaches the card regardless. This stops the BUBBLE half of that, so
          // an ancestor whose plain onClick opens the item does not also run.
          // The capture half is a different problem with a different fix, and it
          // is in useCardMenu: a capture handler on the card fires BEFORE this
          // one, so nothing written here could have stopped it.
          onClick={(e) => {
            e.stopPropagation()
            // A PICK ANSWERS THE QUESTION, SO THE MENU LEAVES — except where the
            // next pick is likely, which is a menu holding more than one question.
            // "Sort by length" and "descending" are two decisions made in one
            // visit, and a menu that shuts between them makes the second one cost
            // two more presses than the first.
            if (!it.keepOpen) close()
            it.onClick()
          }}
        >
          {it.icon}
          {/* A SUB-LINE IS PART OF THE LABEL, not a second column. "Both / the
              original, then the translation under it" is one row saying one thing
              at two lengths, and a reader who already knows what "Both" means
              never has to read the second line. Only drawn when a row has one, so
              every menu in the app keeps its single-line rows. */}
          {it.sub ? (
            <span className="menu-item-text">
              <span>{it.label}</span>
              <span className="menu-sub">{it.sub}</span>
            </span>
          ) : (
            it.label
          )}
          {/* THE ROW ANSWERS ITSELF WITHOUT BEING OPENED. A row that leads to a
              choice states the current one here — "View · Tiles" — which is the
              second job the control it replaced was doing by simply being visible.
              Faint and mono, so it reads as a value rather than a second label. */}
          {it.meta ? <span className="menu-meta">{it.meta}</span> : null}
          {/* The tick sits at the END of the row rather than in the icon slot: the
              icon says what the row IS and the tick says whether it is on, and
              putting the second where the first goes loses the first. */}
          {it.checked ? <span className="menu-tick" aria-hidden="true"><IconCheck size={14} /></span> : null}
        </button>
        ),
      )}
    </div>,
    document.body,
  )
}

// THE REAL MENU, drawn open and in place, rather than a copy of its markup.
// ActionMenu portals to document.body and positions itself against an anchor, so
// the demo renders the panel's own shape directly — the three kinds of row are
// what the entry is about, and each one here is the component's own output.
if (import.meta.env.DEV) {
  ActionMenu.glossary = {
    demo: (h) =>
      h(
        "div",
        { className: "hand-card hc-r2 more-menu", role: "menu", style: { position: "static" } },
        h("div", { className: "menu-head", key: "h1" }, "show only"),
        h("button", { className: "menu-item", role: "menuitem", key: "a" }, "favourites"),
        h("div", { className: "menu-head", key: "h2" }, "sort"),
        h(
          "button",
          { className: "menu-item", role: "menuitemradio", "aria-checked": "true", key: "b" },
          "Recent",
          h("span", { className: "menu-tick", key: "t" }, "\u2713"),
        ),
        h("button", { className: "menu-item", role: "menuitemradio", "aria-checked": "false", key: "c" }, "Title"),
        h("div", { className: "menu-head", key: "h3" }, "actions"),
        h("button", { className: "menu-item", role: "menuitem", key: "d" }, h(IconExport, { key: "i" }), "Export"),
      ),
  };
}

// MoreMenu — the ⋯ trigger, and the menu it opens. The pairing every card row uses.
//
// The FACE is a prop (1.12.0), because the pattern turned out to be "a glyph that
// opens a list of things to do" rather than "the ⋯ specifically". The selection
// bar's shelf control is exactly this — press it, choose one of five states — and
// building it as a Select meant a dropdown with a placeholder pretending to be a
// value the selection does not have. The default is still the ⋯, so every card row
// is untouched.
export function MoreMenu({ items, icon, label, ariaLabel, tooltip, disabled = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  return (
    <div className="relative" ref={ref}>
      {/* `label` rides straight through to IconButton, so a menu trigger follows
          the Button labels preference like any other control. Left unset it is the
          bare glyph it has always been — which is right for the ⋯ itself, whose
          whole job is to be the thing with no name. */}
      {/* IT SAYS IT OPENS A MENU, AND WHETHER IT IS OPEN. `ScreenMenu` in App.jsx
          has carried both since it was written and this — every ⋯ on every card,
          which is most of the menu triggers in the app — carried neither. To
          anything reading the page rather than looking at it, a control that
          opens a list of verbs was indistinguishable from one that does a thing:
          a screen reader announces "More actions, button" and nothing about the
          menu, and no state when it opens. `IconButton` spreads its rest onto the
          <button>, so both ride straight through.

          Found by the control probe, which reported it as doing nothing at all —
          `ActionMenu` portals its list to <body>, so with no `aria-expanded` on
          the trigger there was no evidence anywhere near it that a press had
          landed. That the probe and a screen reader were both blind to the same
          press is not a coincidence; they were looking for the same missing
          thing. */}
      <IconButton
        icon={icon || <IconMore />}
        label={label}
        ariaLabel={ariaLabel || t("common.more.aria")}
        tooltip={tooltip}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open && !disabled}
        onClick={() => setOpen((o) => !o)}
      />
      <ActionMenu
        open={open && !disabled}
        items={items}
        anchorRef={ref}
        onClose={() => setOpen(false)}
        returnFocusTo={ref}
      />
    </div>
  )
}

// ---- the gesture a card has always been missing -----------------------------
//
// useCardMenu wires one card body to one ActionMenu: right-click, long-press, and
// Shift+F10 / the Menu key.
//
// THE LONG-PRESS IS ALREADY TAKEN, and by something that overlaps. Tooltip opens a
// label after LONG_PRESS_MS on touch, because a phone has no hover and the
// glyph-only buttons would otherwise be unlabelled. A card CONTAINS those buttons,
// so "long-press shows a label" and "long-press opens a menu" are live on the same
// square inch.
//
// They coexist because of what each is attached to. Tooltip's press is on a
// CONTROL; this one is on the card BODY, and any press whose target is inside a
// control is ignored. A thumb on the share glyph gets the label; a thumb on the
// quote gets the menu. That is a constraint on the design rather than a detail:
// bound to the whole card including its buttons, every press on a glyph would race
// a tooltip against a menu and the winner would depend on event order.
//
// Three more touch problems, each of which shows up on real hardware and on no
// test in this repo:
//
//   - iOS raises its own callout (Copy / Look Up) on a long press over text.
//     `-webkit-touch-callout: none` on the card body, in the stylesheet.
//   - A press that becomes a drag is not a press. LONG_PRESS_SLOP already exists;
//     reusing the constant rather than inventing a second one is the point.
//   - The card must not also fire its click. Tooltip already solves that with a
//     suppress-then-eat-the-click ref, so this copies the mechanism rather than
//     re-deriving it.
//
// ---- WHAT A LONG PRESS MEANS, REVISED (1.11.1) ------------------------------
//
// The plan this came from said "long-press always means menu, with no exceptions",
// and put touch's way into a selection in a toolbar toggle instead. That was
// wrong twice over, and both are things you only find with a thumb:
//
//   1. THE THUMB HAD NO WAY TO SELECT TEXT. `-webkit-touch-callout: none` plus a
//      menu on the press means holding a finger on a quote in a note-keeping app
//      could not copy half a sentence out of it. The one gesture every phone has
//      for reaching into text was spent on a menu that already had a ⋯ button.
//   2. LONG-PRESS-TO-SELECT IS WHAT PHONES ACTUALLY DO. Every photo grid, file
//      manager and mail app on both platforms enters multiselect that way. A
//      toolbar toggle is a thing you have to be told about.
//
// So the press now splits by WHERE it lands, and the card says which is which:
//
//   on .card-text     nothing at all — the browser's own selection handles take
//                     over, which is the whole point. Hands off, no preventDefault,
//                     and the stylesheet gives the region its callout back.
//   on a control      Tooltip's label, exactly as before.
//   anywhere else     `onLongPress`, i.e. select this card. The whitespace, the
//                     meta line, the padding, the gaps in the bottom bar.
//
// A surface with no selection to enter (Home's favourites, the search modal)
// passes no `onLongPress` and keeps the menu on the press, because there the menu
// is the only thing a press could usefully do.
const MENU_IGNORE_SELECTOR = ".tp-tip-wrap, button, a, input, textarea, select, label";
// The quote itself, and the note under it. Marked by the cards rather than
// inferred, because "is this a text node" is not a question a pointer event can
// answer — and getting it wrong in the permissive direction means a card you
// cannot select, while getting it wrong the other way means a quote you cannot
// copy out of.
const CARD_TEXT_SELECTOR = ".card-text";

export function useCardMenu(items = [], { onLongPress } = {}) {
  const [at, setAt] = useState(null); // the point the menu is open at, or null
  const cardRef = useRef(null);
  const timer = useRef(null);
  const origin = useRef(null);
  const fired = useRef(false); // a press fired: eat the click that trails it
  const hasMenu = items.length > 0;
  const selectsOnPress = typeof onLongPress === "function";
  const enabled = hasMenu || selectsOnPress;

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  };
  const close = () => setAt(null);

  // A right-click or a press inside one of the card's own controls belongs to that
  // control, not to the card.
  //
  // THE CARD ITSELF DOES NOT COUNT, even when it matches. A work tile IS a
  // <button> — the whole cover is the thing you click to open the book — so a bare
  // `closest('button')` said "this is a control" about every press on it and the
  // gesture did nothing at all on the Library and the Catalogue. Quote cards are
  // divs and never showed it.
  const onControl = (target) => {
    const hit = target?.closest?.(MENU_IGNORE_SELECTOR);
    return !!hit && hit !== cardRef.current;
  };
  // A press inside the quote belongs to the BROWSER: it is how a phone reaches
  // into text at all.
  const onText = (target) => !!target?.closest?.(CARD_TEXT_SELECTOR);

  // Somebody who has dragged across a quote and right-clicked wants Copy — and
  // Look Up, and Translate, and Search With, none of which this menu offers. Taking
  // the browser's menu away from them in a note-keeping app is worse than having no
  // menu at all.
  const hasSelectionInside = (node) => {
    const sel = typeof window !== "undefined" ? window.getSelection?.() : null;
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
    const anchor = sel.anchorNode;
    return !!(anchor && node?.contains?.(anchor));
  };

  // A FIRED PRESS LEAVES NO HIGHLIGHT BEHIND IT.
  //
  // The 500ms hold means two things to two different systems, and both are right:
  // to this hook it is the gesture, and to the browser it is the start of a text
  // selection. So the card came up picked with a stray word highlighted under the
  // menu — nothing was broken, and it looked broken.
  //
  // The stylesheet takes `user-select` away on a touch screen, which stops the
  // highlight ever appearing on the hardware this happens on. This is the other
  // half, for the hardware that rule cannot reach: a hybrid laptop answers
  // `hover: hover` and keeps its selection, and any browser that latches a word
  // BEFORE the timer fires has already drawn it by the time we are called. Both
  // are cheap to fix from here, once, at the moment the press becomes a gesture.
  //
  // Only ever called after a press has fired, so it cannot eat a selection
  // somebody made on purpose: a press that starts on `.card-text` never arms a
  // timer at all, and a press that turns into a drag is cleared before this runs.
  const dropSelection = () => {
    const sel = typeof window !== "undefined" ? window.getSelection?.() : null;
    if (sel && !sel.isCollapsed) sel.removeAllRanges?.();
  };

  const onContextMenu = (e) => {
    if (!hasMenu || onControl(e.target)) return;
    if (hasSelectionInside(cardRef.current)) return; // the browser's menu wins
    e.preventDefault();
    setAt({ x: e.clientX, y: e.clientY });
  };

  const onPointerDown = (e) => {
    if (!enabled || e.pointerType !== "touch" || onControl(e.target)) return;
    // The quote is the browser's. Not even a timer is started: an armed press
    // that is cancelled later still has to decide when, and the finger is already
    // dragging a selection handle by then.
    if (selectsOnPress && onText(e.target)) return;
    fired.current = false;
    clear();
    origin.current = { x: e.clientX, y: e.clientY };
    const { clientX: x, clientY: y } = e;
    timer.current = setTimeout(() => {
      fired.current = true;
      dropSelection();
      if (selectsOnPress) onLongPress({ x, y });
      else setAt({ x, y });
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e) => {
    if (!timer.current || !origin.current) return;
    if (
      Math.abs(e.clientX - origin.current.x) > LONG_PRESS_SLOP ||
      Math.abs(e.clientY - origin.current.y) > LONG_PRESS_SLOP
    ) {
      clear();
    }
  };

  // Shift+F10 and the Menu key are the keyboard's context menu, on every platform
  // that has one. Anchored to the card rather than to a pointer that was never
  // there — hence a rect, not a point, which is what ActionMenu's element anchoring
  // is already for.
  const onKeyDown = (e) => {
    if (!hasMenu) return;
    const wants = e.key === "ContextMenu" || (e.shiftKey && e.key === "F10");
    if (!wants) return;
    e.preventDefault();
    const r = cardRef.current?.getBoundingClientRect?.();
    setAt(r ? { x: r.left + 12, y: r.top + 12 } : { x: 0, y: 0 });
  };

  // RETURNS WHETHER IT ATE THE CLICK, and callers must honour that. A card that
  // composes its own onClickCapture on top of this one (every board that also
  // selects on click) would otherwise run its handler after the press already
  // acted — long-pressing to select would select, then the trailing click would
  // deselect, and the gesture would appear to do nothing at all.
  const onClickCapture = (e) => {
    // A CLICK INSIDE THE MENU IS THE MENU'S, not the card's.
    //
    // The menu renders through a portal, which puts it in document.body and out
    // of the card entirely — in the DOM. React events travel the COMPONENT tree,
    // where the menu is still the card's child, so the card's capture handler
    // runs on every menu click, and it runs FIRST. On every board that selects on
    // click that meant picking any item — Copy, Edit, Delete — also toggled the
    // card it was opened from: the action ran, and quietly took the card out of
    // the selection you were acting on.
    //
    // Reported as `true` (the caller skips its own click handler) rather than
    // stopped: stopping it here is the capture phase, so the click would never
    // reach the menu button it was aimed at and the item would not run at all.
    if (e.target?.closest?.("[role=menu]")) return true;
    if (!fired.current) return false;
    fired.current = false;
    e.preventDefault();
    e.stopPropagation();
    return true;
  };

  // `cardProps` carries NO className, and `menuClass` is returned separately, so a
  // caller composes it into whatever class its card already has. A className inside
  // a spread silently replaces the card's own — which on a HandCard means losing
  // the paper material, the radius and the colour bar in one go, and it looks like
  // a styling bug rather than a spread order bug.
  const cardProps = enabled
    ? {
        ref: cardRef,
        onContextMenu,
        onPointerDown,
        onPointerMove,
        onPointerUp: clear,
        onPointerCancel: clear,
        onClickCapture,
        onKeyDown,
      }
    : { ref: cardRef };

  const menu = hasMenu ? (
    <ActionMenu open={!!at} at={at} items={items} onClose={close} returnFocusTo={cardRef} />
  ) : null;

  // THE PAGE MUST NOT MOVE UNDER AN OPEN MENU (1.14.2).
  //
  // The menu is placed once, in script, at the point the press landed — anchored
  // to a coordinate rather than to the card. That is right, and it means the
  // page scrolling afterwards slides every card out from under a menu that stays
  // pinned where it was. On a desktop the wheel is under the same hand that just
  // right-clicked, so this happened constantly: the menu ends up hanging over
  // some other card, and its actions still belong to a card now off screen.
  //
  // Locked rather than re-anchored on scroll, because the second is a worse
  // answer to a question nobody asked: a menu that chases its card is a menu you
  // can drag around the screen with the wheel, and it still leaves the reader
  // acting on something they can no longer see. The same refcounted lock every
  // dialog uses, so a menu opened over an open sheet does not unlock the page
  // when it closes.
  useBodyScrollLock(!!at);

  // AND THE CARD IT BELONGS TO SAYS SO. A context menu names no target — it is
  // a floating list beside the pointer — so with a grid of near-identical
  // covers, "delete" was being pressed with no confirmation of WHICH one. The
  // card carries the mark rather than the menu carrying a title, because the
  // answer to "which one" is the card itself.
  return {
    cardProps,
    menuClass: enabled ? "card-menu-host" + (at ? " is-menu-target" : "") : "",
    menu,
    open: !!at,
    close,
  };
}

// PickMark — the tick in a card's corner that says whether the card is selected.
//
// ONE DRAWING FOR EVERY BOARD. A quote card, a book cover and a film poster are
// three very different rectangles, and a selection that looked like a checkbox on
// one and a ring on another would be three affordances for one idea.
//
// It is a REAL CHECKBOX under the tick — visually hidden, not display:none, so it
// keeps its role, its checked state, its label and its place in the tab order. The
// span beside it is the thing you see. A div with an onClick would have looked
// identical and told a screen reader nothing.
//
// `label` completes "Select …" / "Deselect …", so the announcement names what is
// being picked rather than saying "checkbox" forty times down a board.
export function PickMark({ picked, onChange, label }) {
  return (
    <label
      className="card-pick"
      // The card underneath selects on click too. Without this, ticking the box
      // toggles once for the input and once for the card, i.e. never.
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={picked}
        aria-label={t(picked ? "common.action.deselect.aria" : "common.action.select.aria", { name: label || t("common.select.target.fallback") })}
        onChange={onChange}
      />
      <span className="card-pick-mark" aria-hidden="true">
        <IconCheck />
      </span>
    </label>
  );
}

// TableActions — the actions cell at the end of a table row.
//
// It was `share` `edit` `del` as tp-links, and `del` is the tell: the same
// action is `delete` on a card and `del` in a table, four files apart, because
// the table cell was narrow and somebody abbreviated. Two names for one action
// is exactly the drift a glyph cannot have. The three are the same three
// QuoteActions draws on a card, so they are now the same three drawings, and the
// cell is narrower than it was with the words in it.
//
// Kept separate from QuoteActions/QuoteTools rather than shared, because they
// differ in the thing that matters: a card's actions are hidden until the card is
// hovered (progressive disclosure — the resting card sheds its button row) and
// fold edit and delete into a ⋯, and a table row's are a column that must always
// be there or the column is empty. Merging them would mean a prop that turns the
// entire behaviour off.
//
// The SET is still the same set, and that part does have to stay in step: a
// table row offers copy, share, edit and delete because that is what the card
// beside it offers, just laid flat in a cell that has the width for it.
export function TableActions({ onCopy, onShare, onPractise, onEdit, onDelete, noun }) {
  const what = noun || t("unit.row.one")
  return (
    <span className="flex items-center justify-end gap-1">
      {onCopy && <FieldIconButton icon={<IconCopy />} ariaLabel={t("common.action.copy.label")} onClick={onCopy} tooltip={t("common.action.copy.row.tip", { noun: what })} />}
      {onPractise && <FieldIconButton icon={<IconPractise />} ariaLabel={t("common.action.practise.label")} onClick={onPractise} tooltip={t("common.action.practise.row.tip", { noun: what })} />}
      {onShare && <FieldIconButton icon={<IconShare />} ariaLabel={t("common.action.share.label")} onClick={onShare} tooltip={t("common.action.share.row.tip", { noun: what })} />}
      {onEdit && <FieldIconButton icon={<IconEdit />} ariaLabel={t("common.action.edit.label")} onClick={onEdit} tooltip={t("common.action.edit.row.tip", { noun: what })} />}
      {onDelete && <FieldIconButton icon={<IconDelete />} ariaLabel={t("common.action.delete.label")} onClick={onDelete} tooltip={t("common.action.delete.row.tip", { noun: what })} danger />}
    </span>
  )
}

// CloseButton — the one way to dismiss a window that sits OVER the screen.
//
// There were five. A literal "×" glyph at font-size 24 (.account-close, three
// call sites), a hand-rolled close cross at strokeWidth 2 (.lightbox-close), a
// "Close" GhostButton in four dialog headers, a "Done" GhostButton in the share
// dialog's footer doing the identical job as the "Close" in its own header, and
// IconBack in the mobile sheet. Nothing was wrong with any one of them; what was
// wrong was that dismissing a window meant looking for whichever one this window
// happened to use.
//
// The exception is deliberate and stays: MobileSheet keeps its back arrow. A
// full-screen sheet does not sit over the screen, it IS the screen, and leaving
// it returns you to where you were — which is what every phone means by ←. So
// the rule is two-line rather than one: a window over content closes with a ×,
// a full-screen sheet goes back with an arrow. Two affordances for two things,
// instead of five for one.
export function CloseButton({ onClick, label, tooltip, disabled = false, className = "" }) {
  const word = label || t("common.action.close.label")
  return (
    <FieldIconButton
      icon={<IconClose />}
      ariaLabel={word}
      onClick={onClick}
      disabled={disabled}
      tooltip={tooltip || t("common.action.close.window.tip", { name: word })}
      className={className}
    />
  )
}

// QuoteTools — copy · share, the two things you do WITH a quote rather than TO
// it, sitting beside the favourite ♥ at the left end of a card's action row.
//
// Both were once one entry in the ⋯ overflow (share) and nothing at all (copy).
// A menu is the right home for an action you take rarely and think about first:
// editing a quote, deleting one. It is the wrong home for the two that are the
// whole point of keeping quotes — a line you saved to send to somebody is a
// line you send, and behind two taps it stops being worth saving.
//
// So they are glyphs in the row, and the ⋯ keeps what is genuinely occasional.
// They ride `.card-tools`, which is the same §7 gate the colour quick-pick uses:
// hidden until the card is hovered or focused on desktop (the resting card still
// shows only its ♥ and its ⋯), standing on a phone, where there is no hover to
// wait for. `alwaysVisible` pins them on where a card stands alone rather than
// in a masonry a pointer sweeps across (the search quote modal).
// It renders whatever list it is given rather than knowing the actions itself:
// the list comes from actions.jsx, so the card, the context menu and the bulk bar
// cannot end up offering different sets. `actions` is already filtered to the row
// placement by the caller (atRow).
export function QuoteTools({ actions = [], alwaysVisible = false }) {
  if (!actions.length) return null;
  return (
    <span className={"card-tools" + (alwaysVisible ? " is-visible" : "")}>
      {actions.map((a) => (
        <FieldIconButton
          key={a.id}
          icon={a.icon}
          ariaLabel={a.label}
          onClick={a.run}
          tooltip={a.tooltip || a.label}
          danger={!!a.danger}
        />
      ))}
    </span>
  );
}

// QuoteActions — the ⋯ overflow at the right end of a quote card's action row:
// edit and delete.
//
// It used to be share · edit · delete, drawn inline on desktop and folded into
// this menu on a phone. Two changes retired that. Share moved out to QuoteTools,
// because it belongs with copy at the sending end of the row; and what is left
// is a menu at every width instead of a menu on phones and three glyphs on
// desktop, which was the same component putting the same actions in two
// different places depending on the size of the window.
//
// One ⋯ is also the right resting state for these two specifically. Edit changes
// what somebody wrote down and delete throws it away — neither is a thing to
// offer at a sweep of the pointer, and both are exactly what a reader expects to
// find behind an overflow. The menu is always visible (it is one quiet glyph),
// so nothing on the card is unreachable without hovering it.
export function QuoteActions({ actions = [] }) {
  if (!actions.length) return null;
  return <MoreMenu items={actions.map((a) => ({ ...a, onClick: a.run }))} />;
}

// MobileSheet — a full-screen overlay for mobile filter pages and forms (§7).
// On narrow screens it covers the entire viewport with a sticky header
// (back/close + title + optional `actions`), a scrollable body, and an optional
// pinned footer (see SheetFooter). Callers compose the controls inside the body;
// on desktop the sheet is never rendered.
//
// `actions` is where a form's own Save / Help glyphs go — the title bar, not a
// row at the bottom of a long scroll. It replaces the spacer that balanced the
// close button, so a sheet with no actions still centres its title.
//
// `dismissOnScrim` is off for forms: a filter sheet loses nothing to a stray tap
// beside the card, and a half-written quote loses everything.
// `closeDanger` makes the dismiss the DISCARDING half of the standing pair, and
// it changes the glyph as well as the colour. A sheet's default exit is a back
// arrow, which is right for a filter sheet — nothing is lost by leaving — and
// wrong for a form, where leaving throws away what was typed. The repo's rule is
// that the cross is red and the tick is not, and a rule that held on a desk and
// not on a phone would be two rules; the desk branch of FormModal has drawn this
// pair since the rule was written, and this is the same pair.
export function MobileSheet({ open, onClose, title, actions, children, footer, dismissOnScrim = true, closeDanger = false }) {
  useBackToClose(open, onClose);
  useBodyScrollLock(open);
  if (!open) return null;
  return (
    <div className="mobile-sheet" onClick={dismissOnScrim ? onClose : undefined}>
      <div className="mobile-sheet-card" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-sheet-header">
          <Tooltip label={t("common.sheet.close.tip")} side="bottom" className="shrink-0">
            <button
              type="button"
              className="mobile-sheet-close"
              onClick={onClose}
              aria-label={t("common.action.close.label")}
              style={closeDanger ? { color: "var(--error)" } : undefined}
            >
              {closeDanger ? <IconClose /> : <IconBack />}
            </button>
          </Tooltip>
          <h2 className="mobile-sheet-title">{title}</h2>
          {actions || <span className="mobile-sheet-spacer" />}
        </div>
        <div className="mobile-sheet-body">
          {children}
        </div>
        {footer && <div className="mobile-sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}

// SheetFooter — the standard filter-sheet footer: Reset · live result count ·
// Done. Keeps every sheet's exits consistent instead of relying on the back
// arrow alone.
export function SheetFooter({ count, onReset, onDone }) {
  return (
    <>
      {/* RESET IS A REAL BUTTON, bordered and worded, and it wears the delete
          tint. It was a 34px glyph key in a footer whose other control is a
          110px filled primary — so the one thing on this sheet that throws work
          away was also the quietest thing on it, and a reader had to already
          know what an anticlockwise arrow meant. It is not destructive of DATA,
          which is why it is a tinted ghost rather than a filled slab: the tint
          is the app's whole vocabulary for "this undoes something".

          `keepLabel`, so the word survives the labels preference resolving to
          off on a phone — which is the only place this footer is drawn. A
          reader who has switched words off everywhere still loses it, which is
          the rule: an app default may not stand over an answered question. */}
      {onReset && (
        <GhostButton icon={<IconRevert />} keepLabel className="tp-btn-danger" onClick={onReset}>
          {t("common.filters.reset.label")}
        </GhostButton>
      )}
      {count != null && <span className="microcopy">{count}</span>}
      <button type="button" className="tp-btn tp-btn-primary ml-auto" style={{ minWidth: 110 }} onClick={onDone}>
        {t("common.action.done.label")}
      </button>
    </>
  )
}

// ProgressBar — determinate progress for long-running jobs (covers refetch):
// a recessed track with an accent fill and a mono caption, replacing the dead
// "busy button" experience with visible movement.
export function ProgressBar({ value, max, label }) {
  // Indeterminate when the total isn't known yet (max <= 0): show a sliding
  // stripe so the bar is visible from the first paint — even a run that finishes
  // in a single chunk shows movement, instead of React batching the set-then-
  // clear into one render so the bar never appears at all.
  const indeterminate = !(max > 0)
  const pct = indeterminate ? 0 : Math.min(100, Math.round((value / max) * 100))
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={max || undefined} aria-valuenow={indeterminate ? undefined : value} aria-label={label || t("common.progress.aria")}>
      <div className="progress-track">
        {indeterminate
          ? <div className="progress-fill progress-indeterminate" />
          : <div className="progress-fill" style={{ width: `${pct}%` }} />}
      </div>
      {label && <p className="microcopy mt-1">{label}</p>}
    </div>
  )
}

// ---- toast (§7 redesign: mutations answer with an ink-on-cream pill) ----
// One slot app-wide: a new toast replaces the current one and restarts the
// TOAST_MS timer; each message is re-keyed so repeats replay the entrance.
// toast() is a module-level function so any handler can call it without
// threading a prop chain — ToastHost (mounted once in App) does the rendering.
//
// Both timers are deliberately short. A toast is not a document: every message
// in the app is five words or fewer (a house rule — see the strings at the
// call sites), which is one glance, and a pill still sitting there several
// seconds after the glance reads as something you are expected to act on.

const TOAST_MS = 1500 // a mutation confirmation — news, so slightly longer
// An ACTIONABLE toast lives longer, and it has to: 1.5s is one glance, which is
// right for news and useless for an offer. Six seconds is about how long it takes
// to read "deleted · Undo", decide, and reach it — and the offer does not expire
// in any real sense when it goes, because the bin holds the thing for thirty days.
// The pill is just the shortcut.
const TOAST_ACTION_MS = 6000
const HINT_MS = 1200 // a control's own label, on touch — one glance

let toastSink = null
let hintSink = null
let hintSeq = 0

// toast(msg) shows a pill; toast(msg, {label, onClick}) shows one with a single
// action beside it. There is no two-action form and there should not be: a toast
// is a glance, and a choice is a dialog.
export function toast(msg, action) {
  if (toastSink) toastSink(msg, action)
}

// ---- the hint slot: one label bubble, two lifetimes ----
// Its own slot rather than a variant of toast(), because the two can legitimately
// be on screen at once (hold a button, read its label, tap it, get its
// confirmation) and they must not fight over one message.
//
// Every call returns a TOKEN and every close names one. Moving a mouse between
// two adjacent controls interleaves the second control's enter with the first's
// leave, and a blind close would race the new label off the screen; a token means
// a stale close is simply ignored.

// showHint pins a label until hideHint — the hover / keyboard-focus path.
//
// `hold` OPTS OUT OF THE CAP, and the default is that there IS one. It was the
// other way round until the bubbles started sticking: the cap lived in Tooltip,
// as a timer that component set for itself, and Toggle — the only other caller —
// opened its labels straight through this function with no timer at all. So a
// toggle's label closed on pointerleave and on nothing else, and pointerleave is
// not a promise: the control re-renders under the pointer, a panel opens over
// it, the row reflows, and the label sits there until the page is reloaded.
//
// A cap that one of two callers remembers is not a cap. It lives in the host
// now, on the way through, so a third caller inherits it without knowing.
export function showHint(msg, rect, side, hold = false) {
  if (!hintSink) return 0
  const token = ++hintSeq
  hintSink({ msg, rect: rect || null, side, sticky: true, hold, token })
  return token
}

// hideHint closes the bubble iff `token` is the one still showing.
export function hideHint(token) {
  if (token && hintSink) hintSink({ hide: token })
}

// hintToast shows a label for HINT_MS — the long-press path, where the finger has
// already lifted and no "leave" is ever coming.
export function hintToast(msg, rect, side) {
  if (!hintSink) return 0
  const token = ++hintSeq
  hintSink({ msg, rect: rect || null, side, sticky: false, token })
  return token
}

// HintBubble — the anchored label. Placement needs the bubble's real size, which
// needs one paint, so the first frame renders hidden (pos === null) and
// useLayoutEffect measures and places it before the browser shows anything.
// Every edge is clamped to the viewport: this is the control that used to widen
// the page sideways.
function HintBubble({ msg, rect, side }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const GAP = 9 // the offset the CSS bubble used, kept so nothing moved
    const EDGE = 8 // smallest gap the bubble keeps from a screen edge
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = el.offsetWidth
    const h = el.offsetHeight
    if (!rect) {
      // No source — a caller that fired the hint itself rather than a control.
      // Top-centre, still clamped rather than translated.
      setPos({ top: EDGE + 6, left: Math.max(EDGE, (vw - w) / 2) })
      return
    }
    // `side` is a preference, not an instruction: take it when the bubble fits
    // there and flip when it does not. Both branches are clamped, because a
    // control near either edge can leave no room on its preferred side either.
    const roomAbove = rect.top - GAP - h >= EDGE
    const roomBelow = rect.bottom + GAP + h <= vh - EDGE
    const above = side === "bottom" ? !roomBelow && roomAbove : roomAbove || !roomBelow
    const top = above
      ? Math.max(EDGE, rect.top - GAP - h)
      : Math.min(rect.bottom + GAP, Math.max(EDGE, vh - h - EDGE))
    const left = Math.max(EDGE, Math.min(rect.left + rect.width / 2 - w / 2, vw - w - EDGE))
    setPos({ top, left })
  }, [msg, rect, side])
  return (
    <div
      ref={ref}
      className="hint-bubble"
      role="tooltip"
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: "hidden" }}
    >
      {msg}
    </div>
  )
}

export function ToastHost() {
  const [pill, setPill] = useState({ msg: "", action: null, n: 0 })
  const [h, setH] = useState({ msg: "", n: 0, rect: null, side: "top", sticky: false, token: 0 })
  useEffect(() => {
    toastSink = (msg, action) => setPill((s) => ({ msg, action: action || null, n: s.n + 1 }))
    hintSink = (m) =>
      setH((s) => {
        // Returning `s` itself, not a copy, when the close is stale or the bubble
        // is already gone: React bails out of a re-render on an identical value,
        // and closes arrive in pairs (pointerleave, then blur).
        if (m.hide != null) return m.hide === s.token && s.msg ? { ...s, msg: "" } : s
        return { msg: m.msg, rect: m.rect, side: m.side || "top", sticky: m.sticky, hold: !!m.hold, token: m.token, n: s.n + 1 }
      })
    return () => { toastSink = null; hintSink = null }
  }, [])
  useEffect(() => {
    if (!pill.msg) return
    const id = setTimeout(() => setPill((s) => ({ ...s, msg: "" })), pill.action ? TOAST_ACTION_MS : TOAST_MS)
    return () => clearTimeout(id)
  }, [pill])
  useEffect(() => {
    // EVERY BUBBLE GETS A TIMER HERE, which is the change. The long-press toast
    // always had one; a hovered label was left to its opener on the reasoning
    // that "the pointer leaving is what closes it" — true only while the control
    // stays under the pointer, and false every time one re-renders, gets covered
    // or reflows. Those labels then stayed up for the rest of the session.
    //
    // `hold` is the one exception and it is keyboard focus: somebody reading a
    // label with the keyboard has not asked for it to vanish mid-sentence, and
    // their bubble is closed by blur, which — unlike pointerleave — always
    // arrives.
    if (!h.msg || h.hold) return
    const id = setTimeout(() => setH((s) => ({ ...s, msg: "" })), h.sticky ? HOVER_HIDE_MS : HINT_MS)
    return () => clearTimeout(id)
  }, [h])
  return (
    <>
      {pill.msg && (
        // role="status" for the message, with the action as a real button inside
        // it: a polite live region announces the text, and the button is reachable
        // by keyboard for as long as the pill is up. Dismissing on click is the
        // point — the offer is taken, so the pill has nothing left to say.
        <div className="toast" key={pill.n} role="status">
          {pill.msg}
          {pill.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                setPill((s) => ({ ...s, msg: "" }))
                pill.action.onClick()
              }}
            >
              {pill.action.label}
            </button>
          )}
        </div>
      )}
      {/* Re-keyed per message so a repeat replays the entrance — and so the
          bubble remounts, which re-runs its measure-and-place pass. */}
      {h.msg && <HintBubble key={h.n} msg={h.msg} rect={h.rect} side={h.side} />}
    </>
  )
}
