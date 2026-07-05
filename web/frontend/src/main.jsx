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
import '@fontsource/noto-serif-bengali/400.css'
import './index.css'
import App from './App.jsx'
import { applyTheme } from './theme.js'
import { initTactile } from './ui.jsx'

applyTheme({}) // defaults until /auth/me preferences load (§4)
initTactile() // "press where you clicked" for .tactile toggles + buttons
createRoot(document.getElementById('root')).render(<App />)
