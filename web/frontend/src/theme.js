// Theme system — UI instructions §4. Two aesthetics × light/dark + accent,
// applied as data attributes + CSS custom properties on <html>.

export const ACCENTS = {
  terracotta: '#B4482D',
  ochre: '#C8992B',
  olive: '#3F7D5A',
  slate: '#2F6D8F',
}

// §4 palettes verbatim; tokens the spec leaves out are derived in-key.
const PALETTES = {
  'paper-light': {
    bg: '#F4EDDE', raised: '#FBF6EA', card: '#FFFEF9',
    'card-top': '#FFFFFC', 'card-bottom': '#FCF8ED',
    'topbar-top': '#F3EBDB', 'topbar-bottom': '#EDE3D1',
    ink: '#221C16', soft: '#6A5F50', faint: '#8A7C68', line: '#E4DAC7',
    'ink-border': 'rgba(41,38,29,.6)', 'frame-border': 'rgba(41,38,29,.35)',
    amber: '#BE8A4E', note: '#221C16', error: '#A93B26', ok: '#3E8E5A',
    strip: '#E9E1CC', holes: '#F7F2E6', 'holes-border': '#D3C7AB', 'holes-glow': 'none',
    rating: 'var(--accent-ui)',
  },
  'paper-dark': {
    bg: '#262019', raised: '#2A231C', card: '#2F2820',
    'card-top': '#352D23', 'card-bottom': '#2C251E',
    'topbar-top': '#2B241C', 'topbar-bottom': '#241E17',
    ink: '#EFE6D4', soft: '#B3A48C', faint: '#9A8C74', line: '#453B2D',
    'ink-border': 'rgba(239,230,212,.4)', 'frame-border': 'rgba(214,162,92,.3)',
    amber: '#D6A25C', note: '#E8DCC2', error: '#C96B5B', ok: '#5FB47E',
    strip: '#1C1710', holes: 'rgba(239,230,212,.4)', 'holes-border': 'transparent', 'holes-glow': 'none',
    rating: 'var(--accent-ui)',
  },
  'film-light': {
    bg: '#F1ECE1', raised: '#F7F2E6', card: '#FAF6EC',
    'card-top': '#FDFAF3', 'card-bottom': '#F7F2E4',
    'topbar-top': '#F0EADB', 'topbar-bottom': '#EAE2CF',
    ink: '#2A241C', soft: '#6A5F50', faint: '#8A7C68', line: '#DFD6C4',
    'ink-border': 'rgba(42,36,28,.55)', 'frame-border': 'rgba(185,138,68,.4)',
    amber: '#B98A44', note: '#2A241C', error: '#A93B26', ok: '#3E8E5A',
    strip: '#E9E1CC', holes: '#F7F2E6', 'holes-border': '#D3C7AB', 'holes-glow': 'none',
    rating: 'var(--amber)',
  },
  'film-dark': {
    bg: '#15100C', raised: '#201A13', card: '#201A13',
    'card-top': '#251E16', 'card-bottom': '#1D1710',
    'topbar-top': '#201913', 'topbar-bottom': '#19130D',
    ink: '#ECE3D1', soft: '#A2937C', faint: '#8E8069', line: '#322A20',
    'ink-border': 'rgba(236,227,209,.35)', 'frame-border': 'rgba(214,162,92,.3)',
    amber: '#D6A25C', note: '#ECE3D1', error: '#C96B5B', ok: '#5FB47E',
    strip: '#0F0B07', holes: 'rgba(236,227,209,.5)', 'holes-border': 'transparent',
    'holes-glow': '0 0 6px rgba(236,227,209,.2)',
    rating: 'var(--amber)',
  },
}

let current = { aesthetic: undefined, theme: 'system', accent: 'terracotta' }
const media = window.matchMedia('(prefers-color-scheme: dark)')
media.addEventListener('change', () => {
  if (current.theme !== 'light' && current.theme !== 'dark') apply() // live "system" updates
})

// applyTheme({aesthetic, theme, accent}) — all optional; defaults per §4:
// theme "system", aesthetic light→paper / dark→film, accent terracotta.
export function applyTheme({ aesthetic, theme, accent } = {}) {
  current = { aesthetic, theme: theme || 'system', accent: accent || 'terracotta' }
  apply()
}

// getResolvedTheme returns the appearance currently applied: the concrete
// aesthetic (paper|film) read off the DOM — so it reflects the resolved value
// even when the stored pref was unset/derived — plus the theme *preference*
// (light|dark|system) and accent. Settings inits its toggles from this so they
// always mirror what's on screen rather than a stale prop.
export function getResolvedTheme() {
  const root = document.documentElement
  return {
    aesthetic: root.dataset.aesthetic === 'film' ? 'film' : 'paper',
    theme: current.theme || 'system',
    accent: current.accent || 'terracotta',
  }
}

// paletteTheme returns the canvas theme object (the shape quoteImage's readTheme
// produces) for an explicit aesthetic + mode, independent of what's applied to
// the DOM. Used by the share-image picker to render any of the four skins
// without touching the live app theme. `accentHex` keeps the app's accent.
export function paletteTheme(aesthetic, dark, accentHex) {
  const aes = aesthetic === 'film' ? 'film' : 'paper'
  const p = PALETTES[aes + '-' + (dark ? 'dark' : 'light')]
  return {
    aesthetic: aes,
    dark: !!dark,
    bg: p.bg,
    cardTop: p['card-top'],
    cardBottom: p['card-bottom'],
    ink: p.ink,
    soft: p.soft,
    faint: p.faint,
    line: p.line,
    amber: p.amber,
    accent: accentHex || ACCENTS.terracotta,
    inkBorder: p['ink-border'],
  }
}

function apply() {
  const dark = current.theme === 'dark' || (current.theme !== 'light' && media.matches)
  const aesthetic =
    current.aesthetic === 'paper' || current.aesthetic === 'film'
      ? current.aesthetic
      : dark ? 'film' : 'paper'
  const root = document.documentElement
  root.dataset.aesthetic = aesthetic
  root.dataset.theme = dark ? 'dark' : 'light'
  const palette = PALETTES[aesthetic + '-' + (dark ? 'dark' : 'light')]
  for (const [k, v] of Object.entries(palette)) root.style.setProperty('--' + k, v)
  const accent = ACCENTS[current.accent] || ACCENTS.terracotta
  root.style.setProperty('--accent', accent)
  // dark-surface accent variant is derived (§4)
  root.style.setProperty('--accent-dark', `color-mix(in oklab, ${accent}, white 20%)`)
  root.style.setProperty('--accent-ui', dark ? `color-mix(in oklab, ${accent}, white 20%)` : accent)
  window.dispatchEvent(new CustomEvent('tippani:theme', { detail: { aesthetic, dark } }))
}
