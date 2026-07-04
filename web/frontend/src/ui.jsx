// Shared visual primitives — plain constants + tiny helpers, one place (KISS).
// Neutral palette with dark: variants everywhere, small text, rounded borders.

export const inputClass =
  'w-full rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500'

export const buttonClass =
  'rounded bg-neutral-900 dark:bg-neutral-100 px-3 py-2 text-sm font-medium text-white dark:text-neutral-900 disabled:opacity-50'

export const ghostButtonClass =
  'rounded border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50'

export const cardClass =
  'rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'

export const chipClass =
  'inline-block rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs text-neutral-600 dark:text-neutral-300'

export const linkButtonClass =
  'text-xs text-neutral-500 dark:text-neutral-400 underline hover:text-neutral-900 dark:hover:text-neutral-100'

export const deleteButtonClass = 'text-xs text-red-600 underline'

// The four annotation colors the API accepts (default yellow).
export const ANNOTATION_COLORS = ['yellow', 'blue', 'pink', 'orange']
export const colorDotClass = {
  yellow: 'bg-yellow-400',
  blue: 'bg-blue-400',
  pink: 'bg-pink-400',
  orange: 'bg-orange-400',
}

// splitCommas turns a comma-separated input value into a trimmed string array.
export function splitCommas(s) {
  return s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function ErrorText({ children }) {
  if (!children) return null
  return <p className="text-sm text-red-600">{children}</p>
}

export function EmptyState({ children }) {
  return (
    <p className="py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">{children}</p>
  )
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

// Cover renders a locally-served cover/poster image (GET /covers/{file}), or a
// placeholder block with the title initial. Remote candidate images are never
// hotlinked — the CSP is 'self'-only (PLAN §6).
export function Cover({ path, title, large = false }) {
  const size = large ? 'h-36 w-24 text-2xl' : 'h-14 w-10 text-sm'
  if (path) {
    return (
      <img
        src={`/covers/${path}`}
        alt=""
        className={size + ' shrink-0 rounded border border-neutral-200 dark:border-neutral-800 object-cover'}
      />
    )
  }
  return (
    <span
      className={
        size +
        ' flex shrink-0 items-center justify-center rounded bg-neutral-200 dark:bg-neutral-800 font-semibold text-neutral-500 dark:text-neutral-400'
      }
    >
      {(title || '?').trim().charAt(0).toUpperCase()}
    </span>
  )
}

// filterChipClass styles the small toggle buttons in list filter rows.
export function filterChipClass(active) {
  return (
    'rounded px-2 py-0.5 text-xs ' +
    (active
      ? 'bg-neutral-200 dark:bg-neutral-700 font-medium'
      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100')
  )
}

// FavoriteStar is a row's favorite toggle — filled when on, outline when off.
export function FavoriteStar({ value, onChange }) {
  return (
    <button
      type="button"
      title={value ? 'Unfavorite' : 'Favorite'}
      onClick={() => onChange(!value)}
      className={
        'text-base leading-none ' +
        (value ? 'text-amber-500' : 'text-neutral-300 dark:text-neutral-600 hover:text-amber-500')
      }
    >
      {value ? '★' : '☆'}
    </button>
  )
}

// RatingStars is a 1–5 rating picker; clicking the current value clears to 0.
export function RatingStars({ value, onChange }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          title={n === value ? 'Clear rating' : `Rate ${n}`}
          onClick={() => onChange(n === value ? 0 : n)}
          className={
            'text-sm leading-none ' +
            (n <= value ? 'text-amber-500' : 'text-neutral-300 dark:text-neutral-600 hover:text-amber-400')
          }
        >
          {n <= value ? '★' : '☆'}
        </button>
      ))}
    </span>
  )
}

// MinRatingSelect filters a list by minimum rating; '' means any.
export function MinRatingSelect({ value, onChange }) {
  return (
    <select
      className={inputClass + ' w-auto py-1'}
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

// ColorSwatches renders the four color circles; value '' means none selected
// (used by the filter row alongside an explicit "All" button).
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
            'h-5 w-5 rounded-full ' +
            colorDotClass[c] +
            (value === c
              ? ' ring-2 ring-neutral-900 dark:ring-neutral-100 ring-offset-1 ring-offset-white dark:ring-offset-neutral-900'
              : ' opacity-60 hover:opacity-100')
          }
        />
      ))}
    </span>
  )
}
