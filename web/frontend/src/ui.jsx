// Shared visual primitives for the tippani UI (instructions §5–§6), plus thin
// compatibility exports the pre-redesign pages still import — the page pass
// replaces those call sites, then the compat block can shrink.
import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

// ExpandableDescription clamps body text to 3 lines with a show-more/less toggle
// (the toggle only appears when the text actually overflows). Used in the detail
// hero so the poster beside it keeps a stable height.
export function ExpandableDescription({ text, style }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) setOverflows(el.scrollHeight > el.clientHeight + 2);
  }, [text]);
  if (!text) return null;
  return (
    <div>
      <p
        ref={ref}
        className={open ? "" : "line-clamp-3"}
        style={{
          whiteSpace: "pre-wrap",
          color: "var(--soft)",
          fontSize: 14,
          lineHeight: 1.55,
          ...style,
        }}
      >
        {text}
      </p>
      {(overflows || open) && (
        <button
          className="tp-link"
          style={{ marginTop: 4 }}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "show less" : "show more"}
        </button>
      )}
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

// ExpandableText clamps `text` to `lines` and reveals a WhatsApp-style inline
// colour toggle ("show more"/"show less") only when the text actually overflows.
// The clamp is width-adaptive (CSS line-clamp), so a wider tile shows more text
// before clamping — the "define dynamically based on width available" ask; a
// ResizeObserver re-checks when a resizable tile changes width.
export function ExpandableText({ text, lines = 5, style, className = "" }) {
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
  const clamp = open
    ? null
    : {
        display: "-webkit-box",
        WebkitLineClamp: lines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      };
  return (
    <div className={className}>
      <p
        ref={ref}
        style={{ whiteSpace: "pre-wrap", margin: 0, ...style, ...clamp }}
      >
        {text}
      </p>
      {(overflows || open) && (
        <span
          role="button"
          tabIndex={0}
          className="show-toggle"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((o) => !o);
            }
          }}
        >
          {open ? "show less" : "show more"}
        </span>
      )}
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

// Tooltip — an on-brand hover/focus bubble that replaces native title= tooltips.
// Visibility is pure CSS (hover + focus-within) so it works for pointer and
// keyboard focus; the label wraps in an inverse chip. Wrap any trigger.
export function Tooltip({ label, side = "top", className = "", children }) {
  if (!label) return children;
  return (
    <span className={`tp-tip-wrap ${className}`}>
      {children}
      <span className="tp-tip" role="tooltip" data-side={side}>
        {label}
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

// ---- placeholders & film-strip pieces (§6) ----

// Placeholder — diagonal stripes + mono COVER/POSTER label, 2:3.
export function Placeholder({ kind = "COVER", className = "" }) {
  return (
    <span className={"ph " + className} aria-hidden="true">
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

// MobileSheet — a full-screen overlay for mobile filter pages (§7).
// On narrow screens it covers the entire viewport with a sticky header
// (back/close + title), a scrollable body, and an optional pinned footer
// (see SheetFooter). Callers compose the filter controls inside the body;
// on desktop the sheet is never rendered.
export function MobileSheet({ open, onClose, title, children, footer }) {
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
