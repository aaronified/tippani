import React from 'react'
import { createRoot } from 'react-dom/client'
// The one bundled face: Noto Serif Bengali, the built-in for Bengali since 1.15.0.
// Every Latin role draws in the device's own face (fonts.js FONT_FACES), so no
// other family is shipped. @fontsource splits the face by unicode-range, so a
// subset is only downloaded when a codepoint in its range is drawn.
import '@fontsource/noto-serif-bengali/400.css'
import '@fontsource/noto-serif-bengali/600.css'
import './index.css'
import App from './App.jsx'
import { applyColors, applyLabels, applyTheme } from './theme.js'
import { applyLocale, DEFAULT_LOCALE, ensureBuiltin, ensureBuiltins, loadLocaleFiles, localeActive } from './i18n.js'
import { initTactile } from './ui.jsx'

async function boot() {
  applyTheme({}) // defaults until /auth/me preferences load (§4)
  // The four --hl-N properties, seeded with the built-ins. index.css declares
  // them too, so this is not what makes the first paint correct — it is what
  // makes the JS mirror correct before anyone has logged in, so a share image
  // rendered from the demo shim has real hexes rather than empty strings.
  applyColors({})
  // Before the first render, not after: the label preference is device-local,
  // so it is readable synchronously here. Applying it later would show a phone
  // a frame of fully labelled buttons and then snap them to glyphs.
  applyLabels()
  // The language, before the first render for the same reason the label density
  // is: the device-local mirror is readable synchronously, so the login screen
  // and the first-run screen are already in the reader's words.
  applyLocale()
  // English is compiled into this bundle and needs nothing; Bengali is its own
  // chunk (see i18n.js, which says why) and is AWAITED here when it is the
  // language actually rendering. That keeps the promise the line above makes — a
  // Bengali reader's first screen is in Bengali, not a frame of English that
  // snaps — at the cost of one same-origin request for the reader who wants it,
  // and nothing at all for the reader who does not. Design §3 is unchanged: both
  // languages still ship in the box and the picker still offers both.
  if (localeActive() !== DEFAULT_LOCALE) await ensureBuiltin(localeActive())
  // What the operator ADDED lives in data/Locales and only the server can see it,
  // so it arrives after the first paint. Deliberately not awaited: the interface
  // is complete without it, and blocking boot on a request would trade a working
  // screen for a spinner. i18n.js re-renders the tree only if the payload
  // actually changed, which on an instance with no added language it has not.
  loadLocaleFiles()
  // And the other built-in, quietly, once the screen is up: it is the terminal
  // fallback for whichever language is active (i18n.js, buildChain), so the
  // symmetry §3 asks for is restored a moment after the first paint rather than
  // being paid for before it. Not awaited, for the reason loadLocaleFiles is not.
  ensureBuiltins()
  initTactile() // "press where you clicked" for .tactile toggles + buttons
  createRoot(document.getElementById('root')).render(<App />)
}

// Read-only demo build (VITE_DEMO=1): install the fetch shim BEFORE anything
// renders, so the app's first /auth/me call already hits dummy data. Dead-code
// eliminated from the normal build (the branch + its dynamic import drop out).
if (import.meta.env.VITE_DEMO) {
  import('./demo/install.js').then(({ installDemo }) => {
    installDemo()
    boot()
  })
} else {
  boot()
}
