import React from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts (instructions §3) — display / ui / mono / hand + Bengali
// for the auth-screen brand line only.
import '@fontsource/newsreader/400.css'
import '@fontsource/newsreader/500.css'
import '@fontsource/newsreader/600.css'
import '@fontsource/newsreader/400-italic.css'
import '@fontsource/newsreader/500-italic.css'
import '@fontsource/newsreader/600-italic.css'
import '@fontsource/hanken-grotesk/400.css'
import '@fontsource/hanken-grotesk/500.css'
import '@fontsource/hanken-grotesk/600.css'
import '@fontsource/hanken-grotesk/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/caveat/500.css'
import '@fontsource/caveat/600.css'
import '@fontsource/tiro-bangla/400.css'
import '@fontsource/tiro-devanagari-hindi/400.css'
// The alternates offered in Settings → Type (fonts.js). BUNDLED, NOT FETCHED:
// Tippani never contacts the network on its own, and a type picker that loaded
// Google Fonts would be the first thing in the app that did — on a screen about
// how your own words look. @fontsource splits every face by unicode-range, so a
// subset is only DOWNLOADED when a codepoint in its range is actually drawn;
// what grows unconditionally is the CSS and the image on disk. All OFL-1.1.
import '@fontsource/source-serif-4/400.css'
import '@fontsource/source-serif-4/600.css'
import '@fontsource/source-serif-4/400-italic.css'
import '@fontsource/literata/400.css'
import '@fontsource/literata/600.css'
import '@fontsource/literata/400-italic.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/public-sans/400.css'
import '@fontsource/public-sans/500.css'
import '@fontsource/public-sans/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/source-code-pro/400.css'
import '@fontsource/source-code-pro/500.css'
import '@fontsource/kalam/400.css'
import '@fontsource/gloria-hallelujah/400.css'
import '@fontsource/noto-serif-bengali/400.css'
import '@fontsource/noto-serif-bengali/600.css'
import '@fontsource/hind-siliguri/400.css'
import '@fontsource/noto-serif-devanagari/400.css'
import '@fontsource/noto-serif-devanagari/600.css'
import '@fontsource/hind/400.css'
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
