import { useState } from 'react'
import { FieldIconButton, GhostButton, IconNext, IconSpeaker, IconStop, Select } from './ui.jsx'
import { PrefRow } from './prefRow.jsx'
import { RATES, saveSpeechSettings, skipSpeaking, speak, speakAll, speechSettings, stopSpeaking, useSpeaking, useVoices } from './speech.js'
import { displayName } from './iso639.js'
import { localeActive, t } from './i18n.js'

// SpeakButton — the speaker in a quote card's top-right corner. It draws nothing where the
// browser has no voice, rather than a button that does nothing. `text` is the card's main
// quote as the card draws it; `language` is the language stored on the quote, which is
// passed only when `text` IS the quote and not its translation.
export function SpeakButton({ id, text, language }) {
  const voices = useVoices()
  const playing = useSpeaking() === id
  if (!voices.length || !String(text || '').trim()) return null
  return (
    <span className="card-speak">
      <FieldIconButton
        icon={playing ? <IconStop /> : <IconSpeaker />}
        ariaLabel={playing ? t('speech.stop.label') : t('speech.speak.label')}
        active={playing}
        onClick={(e) => {
          e.stopPropagation()
          if (playing) stopSpeaking()
          else speak(id, text, language)
        }}
      />
    </span>
  )
}

// SpeechFields — Settings' two rows for reading aloud: the speed, and a voice per language. Both
// are this device's (see speech.js), so they are written to the device and not the account.
// A language gets a voice row where the device has a choice to make (two voices or more), and
// the interface's language always does; nothing is drawn where the device has no voice at all.
export function SpeechFields() {
  const voices = useVoices()
  const [cfg, setCfg] = useState(speechSettings)
  if (!voices.length) return null
  const save = (next) => { setCfg(next); saveSpeechSettings(next) }
  const byLang = {}
  for (const v of voices) (byLang[String(v.lang).toLowerCase().split(/[-_]/)[0]] ||= []).push(v)
  const langs = Object.keys(byLang).filter((l) => byLang[l].length > 1 || l === localeActive())
  return (
    <>
      <PrefRow
        label={t('speech.rate.label')}
        info={t('speech.rate.info.body')}
        changed={cfg.rate !== 1}
        control={
          <Select
            value={String(cfg.rate)}
            onChange={(v) => save({ ...cfg, rate: Number(v) })}
            options={RATES.map((r) => [String(r), `${r}x`])}
            ariaLabel={t('speech.rate.label')}
            width={124}
          />
        }
      />
      {langs.map((l) => (
        <PrefRow
          key={l}
          label={t('speech.voice.label', { language: displayName(l) })}
          info={t('speech.voice.info.body')}
          changed={!!cfg.voices[l]}
          control={
            <Select
              value={cfg.voices[l] || ''}
              onChange={(v) => save({ ...cfg, voices: { ...cfg.voices, [l]: v } })}
              options={[['', t('speech.voice.default')], ...byLang[l].map((v) => [v.name, v.name])]}
              ariaLabel={t('speech.voice.label', { language: displayName(l) })}
              width={220}
              filter
            />
          }
        />
      ))}
    </>
  )
}

// ReadAloudRun — "Read aloud" in a board's or an anthology's header: reads `segments()` in order.
// While it plays the same place shows next and stop. `segments` is a function so the page's order
// and switches are read at the press, not when the header drew. Absent where there is no voice.
export function ReadAloudRun({ id, segments, disabled = false }) {
  const voices = useVoices()
  const playing = useSpeaking() === id
  if (!voices.length) return null
  if (!playing) {
    return (
      <GhostButton icon={<IconSpeaker />} onClick={() => speakAll(id, segments())} disabled={disabled}>
        {t('speech.run.label')}
      </GhostButton>
    )
  }
  return (
    <>
      <GhostButton icon={<IconNext />} onClick={skipSpeaking}>{t('speech.run.next.label')}</GhostButton>
      <GhostButton icon={<IconStop />} onClick={stopSpeaking}>{t('speech.stop.label')}</GhostButton>
    </>
  )
}
