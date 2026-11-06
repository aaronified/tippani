// READ ALOUD — the browser's own speech and nothing else.
//
// WHAT THIS IS NOT: a service, a download, a stored recording, or a transcription (ADR-0013). It asks
// `speechSynthesis`, which is the device's, to say words the reader pressed a button for. Nothing here
// speaks on its own, there is no speed control (the device's own speech settings apply), and where the
// device has no voices the controls are not drawn at all rather than drawn dead.
//
// ONE PLAYER FOR THE APP. Starting any passage stops whatever else was playing, so two quote cards can
// never talk over each other, and the control that is playing is the one that shows stop. A run is a
// queue of segments (a passage, its attribution, the reader's note) spoken in order, with next and stop.
//
// A SEGMENT IS `{ text, lang }` OR `{ pause }`. `lang` is a BCP 47 tag the caller got from `tagFor`; a
// pause is milliseconds of silence, which is what a cloze blank becomes (a gap, never a word).
import { languageFor } from './iso639.js'
import { localeActive } from './i18n.js'

const synth = () => (typeof window !== 'undefined' && window.speechSynthesis) || null

// BLANK_PAUSE_MS — a cloze blank is spoken as a beat of silence.
export const BLANK_PAUSE_MS = 600

// ---- language -------------------------------------------------------------------------------------

// tagFor — the language tag a quote is spoken in. A quote's language is free text ("Bengali", "bn",
// "বাংলা"), so `languageFor` resolves it; one this app has never heard of, or none, falls back to the
// interface language, which is the best guess about what a reader of this app reads.
export function tagFor(language) {
  const l = language ? languageFor(language) : null
  return (l && (l.code2 || l.code)) || localeActive() || 'en'
}

// ---- voices ----------------------------------------------------------------------------------------

let voiceChoices = {}

// setVoicePrefs — the reader's `voicesByLanguage` preference, as the JSON string the account stores.
// Read once when the account loads and again when it is saved; unparseable means no choices.
export function setVoicePrefs(raw) {
  try {
    const parsed = typeof raw === 'string' && raw ? JSON.parse(raw) : raw || {}
    voiceChoices = parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    voiceChoices = {}
  }
  emit()
}

export const voiceChoiceFor = (tag) => voiceChoices[String(tag || '').toLowerCase().split('-')[0]] || voiceChoices[String(tag || '').toLowerCase()] || ''

const base = (tag) => String(tag || '').toLowerCase().split('-')[0]

// voicesFor — the device voices that can speak a language, best first: an exact tag match before a
// same-language one.
export function voicesFor(tag, all = deviceVoices()) {
  const t = String(tag || '').toLowerCase()
  return all
    .filter((v) => base(v.lang.replace('_', '-')) === base(t))
    .sort((a, b) => Number(b.lang.toLowerCase() === t) - Number(a.lang.toLowerCase() === t))
}

// pickVoice — the voice an utterance in `tag` should use: the reader's choice for that language if the
// device has it, else the best voice for the language, else null (the device's own default).
export function pickVoice(tag, all = deviceVoices()) {
  const chosen = voiceChoiceFor(tag)
  if (chosen) {
    const hit = all.find((v) => v.name === chosen)
    if (hit) return hit
  }
  return voicesFor(tag, all)[0] || null
}

export function deviceVoices() {
  const s = synth()
  if (!s || typeof s.getVoices !== 'function') return []
  try {
    return s.getVoices() || []
  } catch {
    return []
  }
}

// ---- state -------------------------------------------------------------------------------------------

let state = { id: null, index: 0, total: 0, mark: null }
let voiceCount = deviceVoices().length
const listeners = new Set()
let snapshot = { ...state, voices: voiceCount }

function emit() {
  snapshot = { ...state, voices: voiceCount }
  listeners.forEach((fn) => fn())
}

export const subscribeSpeech = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const speechSnapshot = () => snapshot

// VOICES CAN ARRIVE AFTER LOAD: Chrome fills the list asynchronously and fires `voiceschanged`, so the
// controls appear when the first voice does instead of being decided once at startup.
const s0 = synth()
if (s0 && typeof s0.addEventListener === 'function') {
  s0.addEventListener('voiceschanged', () => {
    const n = deviceVoices().length
    if (n !== voiceCount) {
      voiceCount = n
      emit()
    }
  })
}

export const speechAvailable = () => voiceCount > 0

// ---- the player ---------------------------------------------------------------------------------------

let queue = []
let timer = null
let token = 0

function clear() {
  token++
  if (timer) clearTimeout(timer)
  timer = null
  const s = synth()
  try {
    s?.cancel()
  } catch {
    /* a device that cannot cancel has nothing playing to cancel */
  }
}

function finish() {
  state = { id: null, index: 0, total: 0, mark: null }
  queue = []
  emit()
}

function playAt(i, mine) {
  if (mine !== token) return
  if (i >= queue.length) return finish()
  const seg = queue[i]
  // `mark` names what the segment belongs to (an entry of a run), so the entry playing can wear next and stop.
  state = { ...state, index: i, mark: seg.mark ?? null }
  emit()
  const advance = () => playAt(i + 1, mine)
  if (seg.pause != null) {
    timer = setTimeout(advance, seg.pause)
    return
  }
  const s = synth()
  if (!s || !seg.text || !seg.text.trim()) return advance()
  const u = new window.SpeechSynthesisUtterance(seg.text)
  u.lang = seg.lang || 'en'
  const voice = pickVoice(seg.lang)
  if (voice) u.voice = voice
  u.onend = advance
  // A device that fails an utterance stops the run, rather than skipping on and speaking the rest of a
  // passage out of its order.
  u.onerror = () => {
    if (mine === token) {
      clear()
      finish()
    }
  }
  s.speak(u)
}

// speak — start `segments` as the passage `id`, stopping anything else. A press on the passage that is
// already playing stops it, so one control is play and stop.
export function speak(id, segments) {
  if (!speechAvailable()) return
  if (state.id === id) return stop()
  clear()
  queue = (segments || []).filter((g) => g && (g.pause != null || (g.text && g.text.trim())))
  if (!queue.length) return finish()
  state = { id, index: 0, total: queue.length, mark: null }
  playAt(0, token)
}

// stop — silence, and the control back to play.
export function stop() {
  clear()
  finish()
}

// next — skip to the next segment of a run. At the last one it ends the run.
export function next() {
  if (state.id == null) return
  const mine = ++token
  if (timer) clearTimeout(timer)
  timer = null
  try {
    synth()?.cancel()
  } catch {
    /* nothing playing */
  }
  playAt(state.index + 1, mine)
}

// ---- building what is said ----------------------------------------------------------------------------

const CLOZE_BLANK = '￼'

// textSegments — one text as segments, a cloze blank turned into a pause. `mark` is carried on each.
export function textSegments(text, lang, mark) {
  const parts = String(text || '').split(CLOZE_BLANK)
  const out = []
  parts.forEach((part, i) => {
    if (i > 0) out.push({ pause: BLANK_PAUSE_MS, mark })
    if (part.trim()) out.push({ text: part.trim(), lang, mark })
  })
  return out
}

// quoteSegments — what a single card says: its text only, in its own language.
export function quoteSegments(item) {
  return textSegments(item?.quote || item?.text || item?.line || item?.note || '', tagFor(item?.language))
}

// the id one quote plays under
export const quoteSpeechId = (kind, item) => `${kind || 'quote'}:${item?.id ?? item?.item_id ?? ''}`
