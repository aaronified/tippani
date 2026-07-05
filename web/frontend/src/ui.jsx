// Shared visual primitives for the tippani UI (instructions §5–§6), plus thin
// compatibility exports the pre-redesign pages still import — the page pass
// replaces those call sites, then the compat block can shrink.
import { useEffect, useMemo, useRef, useState } from 'react'

// The four fixed annotation colours (§4, Kindle default yellow).
export const ANNOTATION_COLORS = ['yellow', 'blue', 'pink', 'orange']
export const ANNOTATION_HEX = { yellow: '#E5C355', blue: '#7FA6C9', pink: '#D98CA6', orange: '#DF9A5B' }
export const TAG_STYLES = ['sticker', 'banner', 'flyout', 'tape', 'reel']

// useReveal — reveal-on-scroll (§5). Attach the ref to an element with
// className="reveal"; IO with a scroll fallback, reduced-motion honoured.
export function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-in')
      return
    }
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add('is-in')
            io.disconnect()
          }
        }),
        { rootMargin: '0px 0px -8% 0px' },
      )
      io.observe(el)
      return () => io.disconnect()
    }
    const check = () => {
      if (el.getBoundingClientRect().top < window.innerHeight - 40) {
        el.classList.add('is-in')
        window.removeEventListener('scroll', check)
      }
    }
    window.addEventListener('scroll', check, { passive: true })
    check()
    return () => window.removeEventListener('scroll', check)
  }, [])
  return ref
}

// useResolvedDark — true when theme.js resolved the theme to dark (topbar
// picks the mark variant with this).
export function useResolvedDark() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  useEffect(() => {
    const fn = (e) => setDark(e.detail.dark)
    window.addEventListener('tippani:theme', fn)
    return () => window.removeEventListener('tippani:theme', fn)
  }, [])
  return dark
}

// ---- cards & buttons (§6) ----

const HAND_RADII = ['', 'hc-r1', 'hc-r2', 'hc-r3']

// HandCard — sheen bg, ink border, offset shadow; vary `variant` (0–3) per
// instance for uneven radii; `colorBar` adds the annotation-colour left bar.
export function HandCard({ variant = 0, colorBar, className = '', style, children, ...rest }) {
  const bar = colorBar ? { borderLeft: `4px solid ${ANNOTATION_HEX[colorBar] || colorBar}` } : undefined
  return (
    <div
      className={`hand-card ${HAND_RADII[variant % HAND_RADII.length]} ${className}`}
      style={bar ? { ...bar, ...style } : style}
      {...rest}
    >
      {children}
    </div>
  )
}

export function StickerButton({ className = '', ...rest }) {
  return <button className={'tp-btn btn-sticker ' + className} {...rest} />
}
export function FilmButton({ className = '', ...rest }) {
  return <button className={'tp-btn btn-film ' + className} {...rest} />
}
export function GhostButton({ className = '', ...rest }) {
  return <button className={'tp-btn tp-btn-ghost ' + className} {...rest} />
}

// ---- type bits (§3) ----

export function MonoLabel({ className = '', children, ...rest }) {
  return <span className={'mono-label ' + className} {...rest}>{children}</span>
}
export function Kicker({ className = '', children, ...rest }) {
  return <span className={'kicker ' + className} {...rest}>{children}</span>
}

// PageHeader — Newsreader 24 title + mono counts + right-side actions (§7).
export function PageHeader({ title, counts, right }) {
  return (
    <header className="page-header">
      <div className="ph-left">
        <h1>{title}</h1>
        {counts && <MonoLabel>{counts}</MonoLabel>}
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </header>
  )
}

// Field — mono label above a themed input (§8 form pattern).
export function Field({ label, className = '', ...rest }) {
  return (
    <label className={'tp-field ' + className}>
      <MonoLabel>{label}</MonoLabel>
      <input className="tp-input" {...rest} />
    </label>
  )
}

// ---- tags (§6): five CSS-only styles × four colours ----
// `style` here is the tag style name (sticker|banner|flyout|tape|reel), not a
// React style object — it is consumed, never forwarded to the DOM.
export function TagChip({ color = 'yellow', style = 'sticker', className = '', children, ...rest }) {
  return (
    <span className={`tag-chip tc-${color} ts-${style} ${className}`} {...rest}>
      {children}
    </span>
  )
}

export function HighlightSpan({ children }) {
  return <mark className="hl">{children}</mark>
}

// HandNote — Caveat + accent tick on paper; Newsreader italic on film (§3/§6).
export function HandNote({ className = '', children }) {
  return (
    <p className={'hand-note ' + className}>
      <span className="tick" aria-hidden="true">▍</span>
      {children}
    </p>
  )
}

// ---- ♥ favourite + tilted ★ rating (§6: hearts for favourites, never stars) ----

// FavBadge — a non-interactive ♥ overlay for the corner of a favourited
// cover/poster (the card itself is the clickable element, so this can't be a
// button). Drop-shadowed so it reads over any artwork.
export function FavBadge() {
  return (
    <span
      aria-label="Favourite"
      className="absolute right-1.5 top-1.5"
      style={{ color: '#ef5a5a', fontSize: 18, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.55))' }}
    >
      ♥
    </span>
  )
}

export function Hearts({ value, onChange }) {
  return (
    <button
      type="button"
      className={'heart' + (value ? ' on' : '')}
      title={value ? 'Unfavourite' : 'Favourite'}
      aria-pressed={!!value}
      onClick={onChange ? () => onChange(!value) : undefined}
    >
      {value ? '♥' : '♡'}
    </button>
  )
}

const STAR_TILTS = [-9, 7, -4, 9, -6] // §6 per-glyph rotations

export function TiltStars({ value = 0, onChange }) {
  return (
    <span className="tilt-stars" aria-label={`rated ${value} of 5`}>
      {STAR_TILTS.map((deg, i) => {
        const n = i + 1
        const on = n <= value
        const cls = on ? 'on' : ''
        const tilt = { '--tilt': `${deg}deg` }
        if (!onChange) return <span key={n} className={cls} style={tilt}>{on ? '★' : '☆'}</span>
        return (
          <button
            key={n}
            type="button"
            className={cls}
            style={tilt}
            title={n === value ? 'Clear rating' : `Rate ${n}`}
            onClick={() => onChange(n === value ? 0 : n)}
          >
            {on ? '★' : '☆'}
          </button>
        )
      })}
    </span>
  )
}

// ---- placeholders & film-strip pieces (§6) ----

// Placeholder — diagonal stripes + mono COVER/POSTER label, 2:3.
export function Placeholder({ kind = 'COVER', className = '' }) {
  return (
    <span className={'ph ' + className} aria-hidden="true">
      <span className="mono-label ph-label">{kind}</span>
    </span>
  )
}

export function Sprockets({ count = 9 }) {
  return (
    <div className="sprockets" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <i key={i} />)}
    </div>
  )
}

export function EdgeRow({ left = 'TIPPANI · SAFETY FILM', code }) {
  return (
    <div className="edge-row" aria-hidden="true">
      <span>{left}</span>
      {code != null && <span>{code} ▸</span>}
    </div>
  )
}

export function FrameCode({ children }) {
  return <span className="frame-code" aria-hidden="true">{children}</span>
}

// Frame codes are runtime-random, memoised per mount (§6):
// base = 11 + floor(random()*28); frames render `${base+i}A`.
export function useFrameBase() {
  return useMemo(() => 11 + Math.floor(Math.random() * 28), [])
}
export const frameCode = (base, i = 0) => `${base + i}A`

// ---- compatibility exports (pre-redesign pages; removed in the page pass) ----

export const inputClass = 'tp-input'
export const buttonClass = 'tp-btn tp-btn-primary'
export const ghostButtonClass = 'tp-btn tp-btn-ghost'
export const cardClass = 'hand-card hc-r1'
export const chipClass = 'tp-chip'
export const linkButtonClass = 'tp-link'
export const deleteButtonClass = 'tp-link tp-link-danger'
export const colorDotClass = { yellow: 'dot-yellow', blue: 'dot-blue', pink: 'dot-pink', orange: 'dot-orange' }

// splitCommas turns a comma-separated input value into a trimmed string array.
export function splitCommas(s) {
  return s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function ErrorText({ children }) {
  if (!children) return null
  return <p className="tp-error">{children}</p>
}

export function EmptyState({ children }) {
  return <p className="tp-empty">{children}</p>
}

export function Chips({ items, className = '' }) {
  if (!items || items.length === 0) return null
  return (
    <span className={'flex flex-wrap gap-1 ' + className}>
      {items.map((g) => (
        <span key={g} className={chipClass}>
          {g}
        </span>
      ))}
    </span>
  )
}

// Cover renders a locally-served cover/poster image (GET /covers/{file}), or
// the striped placeholder. Remote images are never hotlinked (CSP 'self').
export function Cover({ path, title, large = false }) {
  const size = large ? 'h-36 w-24' : 'h-14 w-10'
  if (path) {
    return (
      <img
        src={`/covers/${path}`}
        alt={title ? `Cover of ${title}` : ''}
        className={size + ' shrink-0 rounded-md object-cover'}
        style={{ border: '1px solid var(--ink-border)' }}
      />
    )
  }
  return (
    <Placeholder kind={large ? 'COVER' : ''} className={size + ' shrink-0'} />
  )
}

// filterChipClass styles the small toggle buttons in list filter rows.
export function filterChipClass(active) {
  return 'tp-filter-chip' + (active ? ' active' : '')
}

// seriesLabel renders a book/movie's series as "Name #1.5" (or just "Name").
export function seriesLabel(x) {
  if (!x.series) return ''
  return x.series_index ? `${x.series} #${x.series_index}` : x.series
}

// bySeries orders by series name (unseried last), then position, then title —
// the "series" sort option shared by the Library and Movies lists.
export function bySeries(a, b) {
  const sa = a.series || '',
    sb = b.series || ''
  if (sa !== sb) return sa ? (sb ? sa.localeCompare(sb) : -1) : 1
  const ia = a.series_index || 0,
    ib = b.series_index || 0
  if (ia !== ib) return ia - ib
  return a.title.localeCompare(b.title)
}

// FavoriteStar kept its name for compat but renders hearts now (§6).
export function FavoriteStar({ value, onChange }) {
  return <Hearts value={value} onChange={onChange} />
}

export function RatingStars({ value, onChange }) {
  return <TiltStars value={value} onChange={onChange} />
}

// MinRatingSelect filters a list by minimum rating; '' means any.
export function MinRatingSelect({ value, onChange }) {
  return (
    <select
      className="tp-input w-auto"
      title="Minimum rating"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Any rating</option>
      {[1, 2, 3, 4].map((n) => (
        <option key={n} value={n}>
          {n}+
        </option>
      ))}
      <option value="5">5</option>
    </select>
  )
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
          className={'color-dot ' + colorDotClass[c] + (value === c ? ' active' : '')}
        />
      ))}
    </span>
  )
}
