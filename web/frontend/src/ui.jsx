// Shared visual primitives for the tippani UI (instructions §5–§6), plus thin
// compatibility exports the pre-redesign pages still import — the page pass
// replaces those call sites, then the compat block can shrink.
import { Children, Component, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
// Cover/Placeholder resolve stored cover/poster paths to the local /covers URL.
import { coverImgURL } from "./api.js";

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
        <p className="display-title" style={{ fontSize: 22, marginBottom: 8 }}>
          Something broke on this screen
        </p>
        <p className="microcopy" style={{ marginBottom: 16 }}>
          {this.props.label ? this.props.label + " — " : ""}the rest of the app is fine.
        </p>
        <pre
          style={{
            textAlign: "left", whiteSpace: "pre-wrap", overflowWrap: "anywhere",
            fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--error)",
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
          Reload
        </button>
      </div>
    );
  }
}

// The four fixed annotation colours (§4, Kindle default yellow).
export const ANNOTATION_COLORS = ["yellow", "blue", "pink", "orange"];
export const ANNOTATION_HEX = {
  yellow: "#E5C355",
  blue: "#7FA6C9",
  pink: "#D98CA6",
  orange: "#DF9A5B",
};
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

export function useIsMobileScreen() {
  const [mobile, setMobile] = useState(isMobileScreen);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(MOBILE_SCREEN_QUERY);
    const sync = () => setMobile(media.matches);
    sync();
    if (media.addEventListener) {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
    media.addListener?.(sync);
    return () => media.removeListener?.(sync);
  }, []);
  return mobile;
}

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
    ? { borderLeft: `4px solid ${ANNOTATION_HEX[colorBar] || colorBar}` }
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
export function Card({ pad = "p-6", className = "", children }) {
  return <div className={`hand-card ${pad} ${className}`.trim()}>{children}</div>;
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
      <MonoLabel style={{ color: "var(--accent-ui)" }}>{n} selected</MonoLabel>
      {children}
      <GhostButton className="ml-auto" onClick={onClear}>
        Clear
      </GhostButton>
    </div>
  );
}

// PlayfulButton is the shared base: it plays a random button animation on click
// (its own carousel) then calls through to the caller's onClick. `base` is the
// style class (btn-sticker / btn-film / tp-btn-ghost).
function PlayfulButton({ base, className = "", onClick, ...rest }) {
  const { play, animClass, onAnimationEnd } = usePlayful("anim-btn", 3);
  return (
    <button
      {...rest}
      className={`tp-btn tactile ${base} ${animClass} ${className}`}
      onClick={(e) => {
        play();
        onClick?.(e);
      }}
      onAnimationEnd={onAnimationEnd}
    />
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

// Field — mono label above a themed input (§8 form pattern).
export function Field({ label, className = "", ...rest }) {
  return (
    <label className={"tp-field " + className}>
      <MonoLabel>{label}</MonoLabel>
      <input className="tp-input" {...rest} />
    </label>
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
export function HandNote({ className = "", children }) {
  return (
    <p className={"hand-note " + className}>
      <span className="tick" aria-hidden="true">
        ▍
      </span>
      {children}
    </p>
  );
}

// ---- ♥ favourite + tilted ★ rating (§6: hearts for favourites, never stars) ----

// randWobble is the ink-mark jitter (§1: user marks are "hand-drawn: tilted,
// uneven, inked" — never machine-perfect). It returns CSS vars for a random
// rotation, scale and vertical nudge so no two hearts or stars sit quite alike;
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
      aria-label="Favourite"
      className="absolute right-1.5 top-1.5"
      style={{
        ...wob,
        color: "#ef5a5a",
        fontSize: 18,
        lineHeight: 1,
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,.55))",
        transform: "rotate(var(--grot)) scale(var(--gscale))",
      }}
    >
      ♥
    </span>
  );
}

export function Hearts({ value, onChange }) {
  const wob = useMemo(() => randWobble(9, 1), []);
  const { play, animClass, onAnimationEnd } = usePlayful("anim-heart", 3);
  return (
    <button
      type="button"
      className={`heart ${animClass}${value ? " on" : ""}`}
      style={wob}
      title={value ? "Unfavourite" : "Favourite"}
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
      {value ? "♥" : "♡"}
    </button>
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
export function ClampMore({ open }) {
  return (
    <span aria-hidden="true" className="clamp-more" data-open={open ? "1" : "0"}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </span>
  );
}

// clampProps builds the shared "click anywhere on the text to toggle" wiring for
// a clamped block: role/tabindex/handlers only when it can actually toggle
// (overflowing, or already open so it can collapse).
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
export function ExpandableDescription({ text, style, lines = 3, className = "" }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, open, lines]);
  if (!text) return null;
  const canToggle = overflows || open;
  const clamp = open
    ? null
    : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" };
  return (
    <div
      className={`clampable${canToggle ? " is-clickable" : ""} ${className}`.trim()}
      aria-expanded={canToggle ? open : undefined}
      {...clampProps(canToggle, () => setOpen((o) => !o))}
    >
      <p
        ref={ref}
        style={{ whiteSpace: "pre-wrap", color: "var(--soft)", fontSize: 14, lineHeight: 1.55, margin: 0, ...style, ...clamp }}
      >
        {text}
      </p>
      {canToggle && <ClampMore open={open} />}
    </div>
  );
}

// usePersistedState mirrors a JSON-serialisable value in localStorage (per
// device) — used for view mode and per-tile sizing, which are viewport prefs
// rather than identity prefs (unlike theme/accent, which live server-side).
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
  const [overflows, setOverflows] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, open, lines]);
  if (!text) return null;
  const canToggle = overflows || open;
  const clamp = open
    ? null
    : {
        display: "-webkit-box",
        WebkitLineClamp: lines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      };
  return (
    <div
      className={`clampable${canToggle ? " is-clickable" : ""} ${className}`.trim()}
      aria-expanded={canToggle ? open : undefined}
      {...clampProps(canToggle, toggle)}
    >
      <p
        ref={ref}
        style={{ whiteSpace: "pre-wrap", margin: 0, ...style, ...clamp }}
      >
        {text}
      </p>
      {canToggle && <ClampMore open={open} />}
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
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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
export function Masonry({ columns = 2, gap = 24, seed = 1, pinnedCount = 0, lockOrder = false, order = "height", className = "", children }) {
  const items = useMemo(() => Children.toArray(children), [children]);
  const n = items.length;
  const cols = Math.max(1, columns);
  const refs = useRef([]);
  // A cheap rolling hash of the child keys: it folds the card IDENTITIES into the
  // signature, so swapping the set for a same-size one (e.g. a filter that keeps
  // the count) still re-opens packing instead of reusing a stale assignment.
  const keyHash = useMemo(() => {
    let hprime = 0;
    for (const it of items) {
      const k = String(it.key);
      for (let j = 0; j < k.length; j++) hprime = (Math.imul(hprime, 31) + k.charCodeAt(j)) | 0;
    }
    return hprime;
  }, [items]);
  // The frozen placement: order = card indices in placement sequence, colOf[i] =
  // card i's column. assignRef holds it; frozenRef latches once expanded; sigRef
  // is the structural signature whose change re-opens free packing; prevLockRef
  // remembers the last lockOrder so we latch only on its rising edge.
  const assignRef = useRef(null);
  const frozenRef = useRef(false);
  const sigRef = useRef("");
  const prevLockRef = useRef(false);
  // pos[i] = { col, top } for card i (left derives from col via CSS calc).
  // height = the tallest column, so the relative container reserves the space.
  const [pos, setPos] = useState([]);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    // A real layout change (card set/identity, columns, seed, pin count) — not an
    // expand/collapse — re-opens free packing.
    const sig = `${n}|${cols}|${seed}|${pinnedCount}|${keyHash}`;
    const sigChanged = sigRef.current !== sig;
    if (sigChanged) {
      sigRef.current = sig;
      frozenRef.current = false;
      assignRef.current = null;
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
        // Placement sequence: "source" keeps children as given (newest-first,
        // pinned prefix on top); "height" sorts tallest-first with a seeded nudge.
        let placeOrder;
        if (order === "source") {
          placeOrder = Array.from({ length: n }, (_, i) => i);
        } else {
          // (1) tallest first — only the non-pinned tail (ties → index).
          const rest0 = Array.from({ length: n - pc }, (_, k) => k + pc).sort((a, b) => hr[b] - hr[a] || a - b);
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
          placeOrder = [];
          for (let i = 0; i < pc; i++) placeOrder.push(i);
          for (const i of rest) placeOrder.push(i);
        }
        // (3) greedy by rows: each card, in that order, onto the shortest column —
        // this FIXES each card's column; every later re-flow only moves tops.
        const colOf = new Array(n);
        const colH0 = Array(cols).fill(0);
        for (const i of placeOrder) {
          let t = 0;
          for (let c = 1; c < cols; c++) if (colH0[c] < colH0[t]) t = c;
          colOf[i] = t;
          colH0[t] += hr[i] + gap;
        }
        assign = { order: placeOrder, colOf };
        assignRef.current = assign;
      }
      // Flow tops from the live (exact) heights, following the frozen columns.
      const colH = Array(cols).fill(0);
      const next = new Array(n);
      for (const i of assign.order) {
        const t = assign.colOf[i];
        next[i] = { col: t, top: colH[t] };
        colH[t] += h[i] + gap;
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
    <div className={className} style={{ position: "relative", height: height || undefined }}>
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
export function Toggle({
  value,
  onChange,
  options,
  label,
  ariaLabel,
  className = "",
}) {
  const ref = useRef(null);
  const thumbRef = useRef(null);
  const drag = useRef(null); // live drag state (never triggers a re-render)
  const suppressClick = useRef(false); // eat the click that trails a real drag
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
  const nearest = (opts, center) => {
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
  };
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
    d.hover = nearest(d.opts, left + d.thumbW / 2);
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
      className={`tp-toggle tactile ${className}`}
      onPointerDown={onPointerDown}
    >
      <span ref={thumbRef} className="tp-toggle-thumb" aria-hidden="true" />
      {options.map(([k, lbl]) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={value === k}
          aria-pressed={value === k}
          className={"tp-toggle-opt" + (value === k ? " is-on" : "")}
          onClick={() => {
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
  placeholder = "add…",
  ariaLabel,
  transform,
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const norm = (t) => (transform ? transform(t) : t);
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
      cleaned.every((t, i) => t === value[i]);
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
  useEffect(() => {
    if (!open) return;
    const fn = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", fn);
    return () => document.removeEventListener("pointerdown", fn);
  }, [open]);
  return (
    <div className="token-input" ref={boxRef}>
      <div
        className="tp-input token-field"
        onClick={() => inputRef.current && inputRef.current.focus()}
      >
        {value.map((t, i) => (
          <span key={t} className="token-pill">
            {t}
            <button
              type="button"
              className="token-x"
              onClick={() => removeAt(i)}
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="token-entry"
          value={text}
          placeholder={value.length ? "" : placeholder}
          aria-label={ariaLabel}
          autoComplete="off"
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setHi(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
      </div>
      {open && matches.length > 0 && (
        <ul className="token-menu">
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
        </ul>
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
  placeholder = "Select…",
  className = "",
  width,
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0); // highlighted row (hover / keyboard)
  const ref = useRef(null);
  const panelRef = useRef(null);
  const thumbRef = useRef(null);
  const idx = options.findIndex(([v]) => v === value);
  const label = idx >= 0 ? options[idx][1] : placeholder;
  useEffect(() => {
    if (open) setHi(idx >= 0 ? idx : 0);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const thumb = thumbRef.current;
    if (!panel || !thumb) return;
    const el = panel.querySelectorAll(".tp-select-opt")[hi];
    if (!el) return;
    thumb.style.height = `${el.offsetHeight}px`;
    thumb.style.transform = `translateY(${el.offsetTop}px)`;
    thumb.style.opacity = "1";
  }, [open, hi, options.length]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") return setOpen(false);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHi((h) => Math.min(options.length - 1, h + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHi((h) => Math.max(0, h - 1));
      } else if (e.key === "Enter" && options[hi]) {
        e.preventDefault();
        onChange(options[hi][0]);
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, hi, options, onChange]);
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
        onClick={() => setOpen((o) => !o)}
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
      {open && (
        <div className="tp-select-panel" role="listbox" ref={panelRef}>
          <span className="tp-select-thumb" ref={thumbRef} aria-hidden="true" />
          {options.map(([v, lbl], i) => (
            <button
              key={v}
              type="button"
              role="option"
              aria-selected={v === value}
              className={"tp-select-opt tactile" + (i === hi ? " is-hi" : "")}
              onMouseEnter={() => setHi(i)}
              onClick={() => {
                onChange(v);
                setOpen(false);
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ConfirmDialog — an on-brand confirmation modal (replaces native confirm()):
// title, optional body, and Cancel / confirm tactile buttons. Escape or a
// backdrop click cancels. Render it conditionally with `open`.
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onCancel && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10"
      style={{ background: "rgba(21,16,12,.55)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onCancel) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="hand-card hc-r2 w-full max-w-md px-6 py-6"
      >
        <h2 className="display-title mb-2" style={{ fontSize: 20 }}>
          {title}
        </h2>
        {body && (
          <div
            className="mb-5"
            style={{ color: "var(--soft)", fontSize: 14, lineHeight: 1.55 }}
          >
            {body}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onCancel}>Cancel</GhostButton>
          <StickerButton onClick={onConfirm}>{confirmLabel}</StickerButton>
        </div>
      </div>
    </div>
  );
}

// FormModal — the shared shell every edit form now opens in (pop-up edits are
// the house style). Desktop: a centred, scrollable dialog over a dimmed page,
// dismissed by Escape, the × , or a backdrop click. Mobile: a full-screen
// MobileSheet, so the on-screen keyboard has room. The form itself supplies its
// Save/Cancel row (Cancel should call onClose); this only frames it. Body scroll
// is locked while open so the page behind can't scroll under the overlay.
export function FormModal({ open, onClose, title, maxWidth = 560, children }) {
  const mobile = useIsMobileScreen();
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  if (mobile) {
    return createPortal(
      <MobileSheet open={open} onClose={onClose} title={title}>
        {children}
      </MobileSheet>,
      document.body,
    );
  }
  // Portal to <body> so the overlay escapes any card's stacking context — an
  // edit modal opened from a masonry tile must sit above every sibling tile
  // (a .hand-card is `isolation: isolate`, so an in-tree modal is trapped and
  // later tiles paint over it).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10"
      style={{ background: "rgba(21,16,12,.55)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="hand-card hc-r2 w-full"
        style={{ maxWidth, padding: "18px 20px 20px" }}
      >
        <div className="mb-3 flex items-center gap-3">
          <h2 className="display-title flex-1" style={{ fontSize: 19 }}>
            {title}
          </h2>
          <button
            type="button"
            className="tp-btn tp-btn-ghost tactile flex items-center justify-center rounded-full"
            style={{ width: 34, height: 34, padding: 0, flexShrink: 0 }}
            onClick={onClose}
            aria-label="Close"
          >
            <IconClose />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// Tooltip — an on-brand hover/focus bubble that replaces native title= tooltips.
// Visibility is pure CSS (hover + focus-within) so it works for pointer and
// keyboard focus; the label wraps in an inverse chip. Wrap any trigger.
// The zero-width holder centers the bubble via flex layout rather than
// translateX(-50%): transform-positioned text lands on half-pixels and skips
// paint-time glyph snapping, which rendered the bubble blurry.
export function Tooltip({ label, side = "top", className = "", children }) {
  if (!label) return children;
  return (
    <span className={`tp-tip-wrap ${className}`}>
      {children}
      <span className="tp-tip-holder" data-side={side}>
        <span className="tp-tip" role="tooltip">
          {label}
        </span>
      </span>
    </span>
  );
}

// InfoDot — a small circled "i" carrying a Tooltip; keeps dense help off the
// page until hovered/focused (replaces the old title= version).
export function InfoDot({ text, side = "top" }) {
  return (
    <Tooltip label={text} side={side}>
      <span tabIndex={0} className="info-dot" aria-label={text}>
        i
      </span>
    </Tooltip>
  );
}

// ---- spaced-repetition status dot (v0.5.0) ----

// STATUS_META — the three repetition statuses (renamed for clarity) plus the
// unseen state, each with its dot colour. Mirrors recallStatus() on the server.
export const STATUS_META = {
  remembered: { label: "Remembered", color: "var(--ok)", filled: true },
  forgetting: { label: "Forgetting", color: "var(--amber)", filled: true },
  "probably-forgotten": { label: "Probably forgotten", color: "var(--error)", filled: true },
  unseen: { label: "Not yet reviewed", color: "var(--faint)", filled: false },
};

// fmtHalfLife renders a memory half-life (days) compactly: hours under a day,
// then days, weeks, months.
function fmtHalfLife(h) {
  if (h < 1) return `${Math.max(1, Math.round(h * 24))}h`;
  if (h < 14) return `${Math.round(h)}d`;
  if (h < 60) return `${Math.round(h / 7)}w`;
  return `${Math.round(h / 30)}mo`;
}

// reviewStatus derives a quote's repetition status from the fields the list
// endpoints attach (reviewed / stability / last_reviewed_at / last_result). It
// mirrors the server's forgetting-curve model p = 2^(-elapsed/half-life):
// remembered at p >= 0.9, forgetting down to 0.5, probably-forgotten below. A
// card whose last answer was a lapse ("forgot") is always probably-forgotten,
// however recently reviewed — the failed recall, not the timestamp, is the
// honest signal (mirrors recallStatus on the server). The tooltip carries the
// half-life and when it next comes due, like the settings InfoDots.
export function reviewStatus(item = {}) {
  const { reviewed, stability, last_reviewed_at, last_result } = item;
  if (!reviewed) return { key: "unseen", ...STATUS_META.unseen, tip: "Not yet reviewed" };
  const h = Math.max(Number(stability) || 1, 1);
  let elapsed = 0;
  if (last_reviewed_at) {
    // Stored UTC "YYYY-MM-DD HH:MM:SS" — normalise to an ISO instant.
    const t = Date.parse(last_reviewed_at.replace(" ", "T") + "Z");
    if (!Number.isNaN(t)) elapsed = (Date.now() - t) / 86400000;
  }
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
  const due = elapsed >= h ? "due now" : `review in ~${fmtHalfLife(h - elapsed)}`;
  return { key, ...meta, tip: `${meta.label} · half-life ${fmtHalfLife(h)} · ${due}` };
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

// ---- placeholders & film-strip pieces (§6) ----

// Placeholder — diagonal stripes + mono COVER/POSTER label, 2:3.
export function Placeholder({ kind = "COVER", className = "", style }) {
  return (
    <span className={"ph " + className} aria-hidden="true" style={style}>
      <span className="mono-label ph-label">{kind}</span>
    </span>
  );
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

export function EdgeRow({ left = "TIPPANI · SAFETY FILM", code }) {
  return (
    <div className="edge-row" aria-hidden="true">
      <span>{left}</span>
      {code != null && <span>{code} ▸</span>}
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

// ---- compatibility exports (pre-redesign pages; removed in the page pass) ----

export const inputClass = "tp-input";
export const buttonClass = "tp-btn tp-btn-primary";
export const ghostButtonClass = "tp-btn tp-btn-ghost";
export const cardClass = "hand-card hc-r1";
export const chipClass = "tp-chip";
export const linkButtonClass = "tp-link";
export const deleteButtonClass = "tp-link tp-link-danger";
export const colorDotClass = {
  yellow: "dot-yellow",
  blue: "dot-blue",
  pink: "dot-pink",
  orange: "dot-orange",
};

// splitCommas turns a comma-separated input value into a trimmed string array.
export function splitCommas(s) {
  return String(s)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
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
  useEffect(() => {
    // A history entry so the hardware/gesture Back closes the viewer instead
    // of leaving the page. popstate (Back) => close; explicit close pops it.
    let closedByPop = false;
    window.history.pushState({ tpLightbox: true }, "");
    const onPop = () => { closedByPop = true; onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("popstate", onPop);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("keydown", onKey);
      // If we're unmounting for a reason other than Back, consume the entry we
      // pushed so the page's own Back still works normally.
      if (!closedByPop && window.history.state && window.history.state.tpLightbox) {
        window.history.back();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Portal to <body>: the detail hero has a filter/will-change ancestor, which
  // makes position:fixed anchor to it instead of the viewport — so a plain
  // render would trap the overlay inside the cover's box. The portal escapes it.
  return createPortal(
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `Cover of ${title}` : "Cover"}
      onClick={onClose}
    >
      <button type="button" className="lightbox-close" aria-label="Close" onClick={onClose}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
      <img
        src={coverImgURL(path)}
        alt={title ? `Cover of ${title}` : ""}
        className="lightbox-img"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}

// Cover renders a locally-served cover/poster image (GET /covers/{file}), or
// the striped placeholder. Remote images are never hotlinked (CSP 'self').
// `zoomable` (detail heroes) makes a real cover open the full-screen Lightbox.
export function Cover({ path, title, large = false, hero = false, zoomable = false }) {
  const [zoom, setZoom] = useState(false);
  // hero: fills its (sized) wrapper at 2:3 — used by the detail header, where the
  // wrapper controls width and adds the drop shadow.
  if (hero) {
    if (path) {
      const img = (
        <img
          src={coverImgURL(path)}
          alt={title ? `Cover of ${title}` : ""}
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
          <button
            type="button"
            className="cover-zoom-btn"
            aria-label={title ? `View cover of ${title} full screen` : "View cover full screen"}
            onClick={() => setZoom(true)}
          >
            {img}
          </button>
          {zoom && <Lightbox path={path} title={title} onClose={() => setZoom(false)} />}
        </>
      );
    }
    return <Placeholder kind="COVER" className="w-full" />;
  }
  const size = large ? "h-36 w-24" : "h-14 w-10";
  if (path) {
    return (
      <img
        src={coverImgURL(path)}
        alt={title ? `Cover of ${title}` : ""}
        className={size + " shrink-0 rounded-md object-cover"}
        style={{ border: "1px solid var(--ink-border)" }}
      />
    );
  }
  return (
    <Placeholder kind={large ? "COVER" : ""} className={size + " shrink-0"} />
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
export function ViewToggle({ value, onChange }) {
  return (
    <Toggle
      ariaLabel="View"
      value={value}
      onChange={onChange}
      options={[
        [
          "tiles",
          <>
            <ViewIcon kind="tiles" /> Tiles
          </>,
        ],
        [
          "list",
          <>
            <ViewIcon kind="list" /> List
          </>,
        ],
        [
          "table",
          <>
            <ViewIcon kind="table" /> Table
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
  const arrow = sort.col === col ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
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
      {label}
      {arrow}
    </th>
  );
}

// filterChipClass styles the small toggle buttons in list filter rows.
export function filterChipClass(active) {
  return "tp-filter-chip tactile" + (active ? " active" : "");
}

// GenreFilter — the shared genre picker used by Library + Catalogue so both
// toolbars read identically: visible tactile chips (All + the most common
// genres, which the caller sorts by frequency) with only the genuine overflow
// tucked into a "More…" tactile dropdown. Rather than a fixed budget (which
// clipped chips behind More on a narrow row), it MEASURES how many chips fit the
// available width — each genre's rendered text width plus a fixed per-chip
// allowance — and shows exactly that many. Recomputes on resize.
export function GenreFilter({ genres, value, onChange }) {
  const chipsRef = useRef(null);
  const canvasRef = useRef(null);
  const [count, setCount] = useState(genres ? genres.length : 0);
  useLayoutEffect(() => {
    const chips = chipsRef.current;
    if (!chips || !genres || genres.length === 0) return;
    const row = chips.closest(".filter-row") || chips.parentElement;
    if (!row) return;
    const measure = () => {
      const canvas =
        canvasRef.current ||
        (canvasRef.current = document.createElement("canvas"));
      const ctx = canvas.getContext("2d");
      const cs = getComputedStyle(chips);
      const fam =
        cs.getPropertyValue("--font-ui").trim() ||
        cs.fontFamily ||
        "sans-serif";
      ctx.font = `600 13px ${fam}`;
      const EXTRA = 38; // per-chip: padding (13×2) + border + inter-chip gap, with slack
      const w = (t) => Math.ceil(ctx.measureText(t).width) + EXTRA;
      // Available width = the row minus its other children (the right-hand
      // controls); the More… select is reserved for separately when it's needed.
      let others = 0;
      for (const c of row.children) {
        if (c === chips || c.classList.contains("tp-select")) continue;
        others += c.getBoundingClientRect().width;
      }
      const avail = row.clientWidth - others - 28; // ≈ inter-item gaps
      const allW = w("All");
      const totalW = allW + genres.reduce((s, g) => s + w(g), 0);
      if (totalW <= avail) return setCount(genres.length); // all chips fit — no More…
      const MORE = 112; // reserve for the More… select once we know it's needed
      let used = allW;
      let n = 0;
      for (let i = 0; i < genres.length; i++) {
        const cw = w(genres[i]);
        if (used + cw <= avail - MORE) {
          used += cw;
          n++;
        } else break;
      }
      setCount(n);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [genres]);

  if (!genres || genres.length === 0) return null;
  const top = genres.slice(0, count);
  const more = genres.slice(count);
  const activeInMore = value && more.includes(value);
  return (
    <>
      <div className="genre-chips" ref={chipsRef}>
        <button
          className={filterChipClass(value === "")}
          onClick={() => onChange("")}
        >
          All
        </button>
        {top.map((g) => (
          <button
            key={g}
            className={filterChipClass(value === g)}
            onClick={() => onChange(value === g ? "" : g)}
          >
            {g}
          </button>
        ))}
      </div>
      {more.length > 0 && (
        <Select
          ariaLabel="More genres"
          value={activeInMore ? value : ""}
          onChange={onChange}
          options={[["", "More…"], ...more.map((g) => [g, g])]}
        />
      )}
    </>
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

// FavoriteStar kept its name for compat but renders hearts now (§6).
export function FavoriteStar({ value, onChange }) {
  return <Hearts value={value} onChange={onChange} />;
}


// ColorSwatches renders the four annotation-colour dots; '' = none selected.
export function ColorSwatches({ value, onChange }) {
  return (
    <span className="flex items-center gap-1.5">
      {ANNOTATION_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onChange(c)}
          className={
            "color-dot " + colorDotClass[c] + (value === c ? " active" : "")
          }
        />
      ))}
    </span>
  );
}

// ---- mobile primitives (§7) ----

const ICON_SIZE = 24

export function IconButton({ icon, ariaLabel, className = "", onClick, ...rest }) {
  return (
    <button
      type="button"
      className={`tp-btn tp-btn-ghost tactile flex items-center justify-center rounded-full ${className}`}
      style={{ width: 44, height: 44, padding: 0, flexShrink: 0 }}
      aria-label={ariaLabel}
      onClick={onClick}
      {...rest}
    >
      {icon}
    </button>
  )
}

const iconStroke = { width: ICON_SIZE, height: ICON_SIZE, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.85, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }

export function IconBack() { return <svg {...iconStroke}><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg> }
export function IconFilter() { return <svg {...iconStroke}><path d="M22 3H2l9 9v9l4-2v-7z"/></svg> }
export function IconExport() { return <svg {...iconStroke}><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 18h16"/></svg> }
export function IconEdit() { return <svg {...iconStroke}><path d="M17 3l4 4L7 19H3v-4z"/></svg> }
export function IconDelete() { return <svg {...iconStroke}><path d="M3 6h18"/><path d="M8 3V2h8v1"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg> }
export function IconPlus() { return <svg {...iconStroke}><path d="M12 5v14"/><path d="M5 12h14"/></svg> }
export function IconSearch() { return <svg {...iconStroke}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg> }
export function IconGrid() { return <ViewIcon kind="tiles" /> }
export function IconList() { return <ViewIcon kind="list" /> }
export function IconTable() { return <ViewIcon kind="table" /> }
export function IconMore() { return <svg {...iconStroke}><circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/></svg> }
export function IconShare() { return <svg {...iconStroke}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 3.5v12"/><path d="m8 7.5 4-4 4 4"/></svg> }
export function IconUpload() { return <svg {...iconStroke}><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/><path d="M12 3.5v11"/><path d="m7.5 8 4.5-4.5 4.5 4.5"/></svg> }
export function IconLink() { return <svg {...iconStroke}><path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 1 0-5-5l-1.5 1.5"/><path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 1 0 5 5l1.5-1.5"/></svg> }
export function IconMetadata() { return <svg {...iconStroke}><path d="M12 3.5v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M4.5 20h15"/></svg> }
export function IconMenu() { return <svg {...iconStroke}><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h12"/></svg> }
export function IconCheck() { return <svg {...iconStroke}><path d="M5 13l4 4L19 7"/></svg> }
export function IconClose() { return <svg {...iconStroke}><path d="M6 6l12 12M18 6 6 18"/></svg> }
export function IconSearch2() { return <svg {...iconStroke}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg> }

// MoreMenu — a small overflow dropdown for actions that don't fit a mobile
// detail bar (export/edit/delete). Opens below the "⋯" trigger; closes on
// outside click or item pick. `items` is [{icon, label, onClick, danger}].
export function MoreMenu({ items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <IconButton icon={<IconMore />} ariaLabel="More actions" onClick={() => setOpen((o) => !o)} />
      {open && (
        <div className="hand-card hc-r2 more-menu" role="menu">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className="menu-item"
              style={it.danger ? { color: "var(--error)" } : undefined}
              onClick={() => {
                setOpen(false)
                it.onClick()
              }}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// QuoteActions — the share · edit · delete cluster on a quote card (§7
// declutter: progressive disclosure). At rest a card shows only its primary
// mark (the favourite ♥, rendered by the caller); these secondary actions stay
// out of the way until wanted. On desktop they sit inline and fade in when the
// card is hovered or focused (the `.card-actions` CSS keys off the card's
// :hover / :focus-within); on a phone (no hover) they fold behind a single ⋯
// overflow so the resting card sheds its standing button row either way.
// `alwaysVisible` pins them on regardless — used where a card stands alone (the
// search quote modal) rather than in a masonry a pointer sweeps across.
export function QuoteActions({ onShare, onEdit, onDelete, alwaysVisible = false }) {
  const mobile = useIsMobileScreen();
  if (mobile) {
    const items = [];
    if (onShare) items.push({ icon: <IconShare />, label: "Share", onClick: onShare });
    if (onEdit) items.push({ icon: <IconEdit />, label: "Edit", onClick: onEdit });
    if (onDelete) items.push({ icon: <IconDelete />, label: "Delete", onClick: onDelete, danger: true });
    return <MoreMenu items={items} />;
  }
  return (
    <span className={"card-actions" + (alwaysVisible ? " is-visible" : "")}>
      {onShare && (
        <button type="button" className="tp-link" onClick={onShare}>
          share
        </button>
      )}
      {onEdit && (
        <button type="button" className="tp-link" onClick={onEdit}>
          edit
        </button>
      )}
      {onDelete && (
        <button type="button" className="tp-link tp-link-danger" onClick={onDelete}>
          delete
        </button>
      )}
    </span>
  );
}

// MobileSheet — a full-screen overlay for mobile filter pages (§7).
// On narrow screens it covers the entire viewport with a sticky header
// (back/close + title), a scrollable body, and an optional pinned footer
// (see SheetFooter). Callers compose the filter controls inside the body;
// on desktop the sheet is never rendered.
export function MobileSheet({ open, onClose, title, children, footer }) {
  useBodyScrollLock(open);
  if (!open) return null;
  return (
    <div className="mobile-sheet" onClick={onClose}>
      <div className="mobile-sheet-card" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-sheet-header">
          <button type="button" className="mobile-sheet-close" onClick={onClose} aria-label="Close">
            <IconBack />
          </button>
          <h2 className="mobile-sheet-title">{title}</h2>
          <span className="mobile-sheet-spacer" />
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
      {onReset && (
        <GhostButton type="button" onClick={onReset}>
          Reset
        </GhostButton>
      )}
      {count != null && <span className="microcopy">{count}</span>}
      <button type="button" className="tp-btn tp-btn-primary ml-auto" style={{ minWidth: 110 }} onClick={onDone}>
        Done
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
    <div role="progressbar" aria-valuemin={0} aria-valuemax={max || undefined} aria-valuenow={indeterminate ? undefined : value} aria-label={label || 'progress'}>
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
// 2200ms timer; each message is re-keyed so repeats replay the entrance.
// toast() is a module-level function so any handler can call it without
// threading a prop chain — ToastHost (mounted once in App) does the rendering.

let toastSink = null

export function toast(msg) {
  if (toastSink) toastSink(msg)
}

export function ToastHost() {
  const [t, setT] = useState({ msg: "", n: 0 })
  useEffect(() => {
    toastSink = (msg) => setT((s) => ({ msg, n: s.n + 1 }))
    return () => { toastSink = null }
  }, [])
  useEffect(() => {
    if (!t.msg) return
    const id = setTimeout(() => setT((s) => ({ ...s, msg: "" })), 2200)
    return () => clearTimeout(id)
  }, [t])
  if (!t.msg) return null
  return (
    <div className="toast" key={t.n} role="status">
      {t.msg}
    </div>
  )
}
