import { describe, expect, it } from 'vitest'
import { pickVoice, speechLanguage } from '../../src/speech.js'

// Which language a quote is read in. The function is the observable unit: it is what a
// press on a card's speaker hands the browser, and a journey cannot hear which it chose.
describe('the language a quote is read in', () => {
  it('is the stored language, because German and English share a script', () => {
    expect(speechLanguage('Es war einmal ein König', 'German')).toBe('de')
    expect(speechLanguage('Es war einmal ein König', '')).toBe('en')
  })
  it('is the one the script says when nothing is stored', () => {
    expect(speechLanguage('যেমন কর্ম তেমন ফল', '')).toBe('bn')
    expect(speechLanguage('Война и мир', undefined)).toBe('ru')
    expect(speechLanguage('我是一只猫', '')).toBe('zh')
    expect(speechLanguage('吾輩は猫である。ありがとう', '')).toBe('ja')
  })
  it('lets the stored language win over the script, and ignores one it does not know', () => {
    expect(speechLanguage('যেমন কর্ম', 'Hindi')).toBe('hi')
    expect(speechLanguage('যেমন কর্ম', 'Sylheti')).toBe('bn')
  })
})

describe('the voice a language is read with', () => {
  const voices = [
    { name: 'A', lang: 'en-GB', localService: false },
    { name: 'B', lang: 'en-US', localService: true },
    { name: 'C', lang: 'bn-BD', localService: false },
  ]
  it('is the chosen one when the device still has it', () => {
    expect(pickVoice(voices, 'en', 'A').name).toBe('A')
  })
  it('falls back to a local voice of that language, then to none', () => {
    expect(pickVoice(voices, 'en', 'Gone').name).toBe('B')
    expect(pickVoice(voices, 'de', '')).toBeNull()
  })
})
