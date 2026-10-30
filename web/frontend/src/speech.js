// Read a quote aloud with the browser's own speech (Web Speech API): no service, no download.
//
// WHICH LANGUAGE, in the owner's order: the language stored on the quote wins, because one
// script serves many languages (German and English are both Latin, so the text cannot tell
// them apart); with none stored, the script of the text decides; Latin with nothing stored is
// English. A stored value iso639.js has never heard of is treated as none.
//
// VOICE AND SPEED ARE THIS DEVICE'S, in localStorage, not the account's: a voice name exists
// only on the device that has it, so a choice synced to a phone would name a voice it lacks.
// Speed defaults to 1, the device's own.

import { useEffect, useState, useSyncExternalStore } from 'react'
import { languageFor } from './iso639.js'

const KEY = 'tippani:speech'

// First script found wins over Latin; among non-Latin scripts the most letters decide.
const SCRIPTS = [
  ['bn', /\p{Script=Bengali}/gu], ['hi', /\p{Script=Devanagari}/gu], ['ar', /\p{Script=Arabic}/gu],
  ['ru', /\p{Script=Cyrillic}/gu], ['el', /\p{Script=Greek}/gu], ['he', /\p{Script=Hebrew}/gu],
  ['th', /\p{Script=Thai}/gu], ['ta', /\p{Script=Tamil}/gu], ['te', /\p{Script=Telugu}/gu],
  ['ko', /\p{Script=Hangul}/gu], ['ja', /[\p{Script=Hiragana}\p{Script=Katakana}]/gu], ['zh', /\p{Script=Han}/gu],
]

export function scriptLanguage(text) {
  let best = ''
  let most = 0
  for (const [code, re] of SCRIPTS) {
    const n = (String(text).match(re) || []).length
    if (n > most) { best = code; most = n }
  }
  // Kana beside Han is Japanese: Han alone would call it Chinese.
  if (best === 'zh' && /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return 'ja'
  return best
}

export function speechLanguage(text, stored) {
  return languageFor(stored)?.code || scriptLanguage(text) || 'en'
}

export const speechAvailable = () =>
  typeof globalThis.speechSynthesis !== 'undefined' && typeof globalThis.SpeechSynthesisUtterance !== 'undefined'

const primary = (tag) => String(tag || '').toLowerCase().split(/[-_]/)[0]

// The chosen voice for a language if the device still has it, else the device's own pick
// for that language: its default voice, then a local one, then any.
export function pickVoice(voices, lang, chosenName) {
  const ofLang = voices.filter((v) => primary(v.lang) === lang)
  return ofLang.find((v) => v.name === chosenName)
    || ofLang.find((v) => v.default) || ofLang.find((v) => v.localService) || ofLang[0] || null
}

// ---- this device's settings ----------------------------------------------------------------
export const RATES = [0.75, 1, 1.25, 1.5]
export function speechSettings() {
  try {
    const s = JSON.parse(globalThis.localStorage?.getItem(KEY) || '{}')
    return { rate: RATES.includes(s.rate) ? s.rate : 1, voices: s.voices && typeof s.voices === 'object' ? s.voices : {} }
  } catch {
    return { rate: 1, voices: {} }
  }
}
export function saveSpeechSettings(next) {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(next)) } catch { /* private window: this session only */ }
}

// ---- the one player ------------------------------------------------------------------------
// Starting one quote stops any other, and the playing control shows stop.
let playing = null
const listeners = new Set()
const emit = (key) => { playing = key; listeners.forEach((f) => f()) }

export function stopSpeaking() {
  if (!speechAvailable()) return
  queue = []
  current = null
  globalThis.speechSynthesis.cancel()
  emit(null)
}

// One quote, or a run of segments ({ text, language }) read in order. Starting one stops any
// other, and the control that started it shows stop while it plays.
export function speakAll(key, segments) {
  if (!speechAvailable()) return
  globalThis.speechSynthesis.cancel()
  queue = segments.filter((x) => String(x?.text || '').trim())
  if (!queue.length) return emit(null)
  next(key)
}
export const speak = (key, text, stored) => speakAll(key, [{ text, language: stored }])

// Leave the passage being read for the next one in the run.
export function skipSpeaking() {
  if (!speechAvailable() || playing == null) return
  const key = playing
  current = null
  globalThis.speechSynthesis.cancel()
  next(key)
}

function next(key) {
  const seg = queue.shift()
  if (!seg) { current = null; emit(null); return }
  const lang = speechLanguage(seg.text, seg.language)
  const { rate, voices } = speechSettings()
  const u = new globalThis.SpeechSynthesisUtterance(seg.text)
  const voice = pickVoice(globalThis.speechSynthesis.getVoices(), lang, voices[lang])
  if (voice) { u.voice = voice; u.lang = voice.lang } else u.lang = lang
  u.rate = rate
  // A cancelled utterance fires end/error after the next one has started, so only the
  // utterance that is still current moves the run on.
  const done = () => { if (current === u) next(key) }
  u.onend = done
  u.onerror = done
  current = u
  emit(key)
  globalThis.speechSynthesis.speak(u)
}
let current = null
let queue = []

export const useSpeaking = () => useSyncExternalStore(
  (f) => { listeners.add(f); return () => listeners.delete(f) },
  () => playing,
)

// Voices can arrive after load, so the control appears when the first one does.
export function useVoices() {
  const [voices, setVoices] = useState(() => (speechAvailable() ? globalThis.speechSynthesis.getVoices() : []))
  useEffect(() => {
    if (!speechAvailable()) return undefined
    const f = () => setVoices(globalThis.speechSynthesis.getVoices())
    f()
    globalThis.speechSynthesis.addEventListener?.('voiceschanged', f)
    return () => globalThis.speechSynthesis.removeEventListener?.('voiceschanged', f)
  }, [])
  return voices
}
