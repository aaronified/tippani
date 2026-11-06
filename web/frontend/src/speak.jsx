import { useState, useSyncExternalStore } from 'react'
import { errText, json } from './api.js'
import { t } from './i18n.js'
import { languageFor } from './iso639.js'
import { GhostButton, IconButton, IconPlayAloud, IconStopAloud, MonoLabel, Select, ErrorText } from './ui.jsx'
import { speak, stop, next, speechSnapshot, subscribeSpeech, quoteSegments, quoteSpeechId, setVoicePrefs, voiceChoiceFor, voicesFor } from './speech.js'

// useSpeech — the one player's state: which passage is playing, how far through its segments, and how
// many voices the device has. Re-renders when any of it changes.
export const useSpeech = () => useSyncExternalStore(subscribeSpeech, speechSnapshot, speechSnapshot)

// SpeakButton — play, and stop while it plays. NOT DRAWN WHERE THE DEVICE HAS NO VOICES: a button that
// does nothing is worse than none. `segments` is a function so what is said is read at the press, from
// the card as it is then. `.no-print`, because a printed page has no speaker.
export function SpeakButton({ id, segments, className = '' }) {
  const s = useSpeech()
  if (!s.voices) return null
  const playing = s.id === id
  const label = t(playing ? 'speech.stop.aria' : 'speech.play.aria')
  return (
    <IconButton
      icon={playing ? <IconStopAloud /> : <IconPlayAloud />}
      ariaLabel={label}
      tooltip={label}
      className={('speak-button no-print ' + className).trim()}
      aria-pressed={playing}
      data-testid="speak-button"
      onClick={() => speak(id, segments())}
    />
  )
}

// QuoteSpeakButton — a quote card's own control: its text, in its own language, and nothing else.
export function QuoteSpeakButton({ kind, item }) {
  const s = useSpeech()
  // THE QUOTE A RUN IS ON wears next and stop, beside its own play: the run's start is in the header of
  // the anthology or board, and what is playing now is a card on the page.
  const running = String(s.id || '').startsWith('run:') && s.mark === quoteSpeechId(kind, item)
  return (
    <>
      {running && <RunControls id={s.id} />}
      <SpeakButton id={quoteSpeechId(kind, item)} segments={() => quoteSegments(item)} />
    </>
  )
}

// RunButton — "Read aloud" in the header of a whole anthology or board, and "Stop" while it plays. Not
// drawn where the device has no voices. The run's id starts `run:` so an entry can tell a run from a
// single card playing.
export function RunButton({ id, segments, disabled = false }) {
  const s = useSpeech()
  if (!s.voices) return null
  const playing = s.id === id
  return (
    <GhostButton
      icon={playing ? <IconStopAloud /> : <IconPlayAloud />}
      className="no-print"
      disabled={disabled}
      aria-pressed={playing}
      onClick={() => speak(id, segments())}
    >
      {t(playing ? 'speech.stop.aria' : 'speech.run.start')}
    </GhostButton>
  )
}

// RunControls — next and stop, worn by whatever is playing in a run (an anthology's or a board's).
export function RunControls({ id }) {
  const s = useSpeech()
  if (s.id !== id) return null
  return (
    <span className="speak-run no-print" role="group" aria-label={t('speech.run.aria')}>
      <IconButton icon={<IconNextAloud />} ariaLabel={t('speech.next.aria')} tooltip={t('speech.next.aria')} onClick={next} />
      <IconButton icon={<IconStopAloud />} ariaLabel={t('speech.stop.aria')} tooltip={t('speech.stop.aria')} onClick={stop} />
    </span>
  )
}

function IconNextAloud() {
  return (
    <svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M52.06 53.34A8 8 0 0 0 40 60v136a8 8 0 0 0 12.06 6.9l112-68a8 8 0 0 0 0-13.8ZM56 181.4V74.6L144 128Zm144-125.4a8 8 0 0 0-8 8v128a8 8 0 0 0 16 0V64a8 8 0 0 0-8-8Z" />
    </svg>
  )
}

// useVoiceChoice — the one writer for `voicesByLanguage`: language code -> the device's voice name. Saved
// as it is chosen (a voice is something you listen to straight away), and handed to the player at once so
// the next passage already uses it.
export function useVoiceChoice(prefs, onSaved) {
  const [err, setErr] = useState('')
  async function choose(tag, name) {
    let table = {}
    try {
      table = JSON.parse(prefs?.voicesByLanguage || '{}') || {}
    } catch {
      table = {}
    }
    if (name) table[tag] = name
    else delete table[tag]
    const patch = { voicesByLanguage: Object.keys(table).length ? JSON.stringify(table) : '' }
    const r = await json('PUT', '/auth/me/preferences', patch)
    if (!r.ok) return setErr(errText(r, t('error.save.generic')))
    setErr('')
    setVoicePrefs(patch.voicesByLanguage)
    onSaved?.(patch)
  }
  return { err, choose }
}

// VoiceSelect — which of the device's voices reads a language aloud. Drawn only where the device has
// voices at all, and only for a language this app can name a tag for. A language the device has no voice
// for says so instead of offering an empty list.
export function VoiceSelect({ languageKey, name, voices }) {
  const s = useSpeech()
  const tag = languageFor(languageKey)?.code
  if (!s.voices || !tag) return null
  const list = voicesFor(tag)
  return (
    <div className="lang-editor-block">
      <MonoLabel>{t('speech.voice.label')}</MonoLabel>
      {list.length === 0 ? (
        <p className="microcopy">{t('speech.voice.none')}</p>
      ) : (
        <Select
          ariaLabel={t('speech.voice.label') + ': ' + name}
          value={voiceChoiceFor(tag)}
          onChange={(v) => voices.choose(tag, v)}
          options={[['', t('speech.voice.default')], ...list.map((v) => [v.name, v.name])]}
        />
      )}
      <ErrorText>{voices.err}</ErrorText>
    </div>
  )
}
