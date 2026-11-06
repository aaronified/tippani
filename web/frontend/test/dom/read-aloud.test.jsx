// READ ALOUD. jsdom has no speech, and a journey cannot hear, so the browser's `speechSynthesis` is
// stood in for here and what is asserted is what was ASKED to be spoken: which text, in which language,
// in what order, that one passage at a time plays, that a press on the playing one stops it, and that
// nothing speaks until a press. Declared exception to "the network is the only fake": this is the other.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let VOICES = []
let SPOKEN = []
let CANCELS = 0
let CHANGED = () => {}

class FakeUtterance {
  constructor(text) { this.text = text; this.lang = ''; this.voice = null }
}
window.SpeechSynthesisUtterance = FakeUtterance
window.speechSynthesis = {
  getVoices: () => VOICES,
  speak: (u) => SPOKEN.push(u),
  cancel: () => { CANCELS++ },
  addEventListener: (type, fn) => { if (type === 'voiceschanged') CHANGED = fn },
}

const speech = await import('../../src/speech.js')
const { SpeakButton, QuoteSpeakButton } = await import('../../src/speak.jsx')
const { anthologyRun, boardRun } = await import('../../src/readRuns.js')

const voice = (name, lang) => ({ name, lang })
const arrive = (...v) => act(() => { VOICES = v; CHANGED() })

beforeEach(() => {
  cleanup()
  speech.stop()
  VOICES = []
  SPOKEN = []
  CANCELS = 0
  speech.setVoicePrefs('')
  CHANGED()
})
afterEach(() => speech.stop())

const lastText = () => SPOKEN.map((u) => `${u.lang}:${u.text}`)
const finishCurrent = () => act(() => SPOKEN[SPOKEN.length - 1].onend())

describe('which language a quote is spoken in', () => {
  it('uses the tag of the language the quote is in, and the interface language when it cannot tell', () => {
    expect(speech.tagFor('Bengali')).toBe('bn')
    expect(speech.tagFor('bn')).toBe('bn')
    expect(speech.tagFor('Klingon-ish')).toBe(speech.tagFor(''))
  })

  it('turns a cloze blank into a pause and never a word', () => {
    const segs = speech.textSegments('The cat sat on the ￼ all day.', 'en')
    expect(segs).toEqual([
      { text: 'The cat sat on the', lang: 'en', mark: undefined },
      { pause: speech.BLANK_PAUSE_MS, mark: undefined },
      { text: 'all day.', lang: 'en', mark: undefined },
    ])
  })
})

describe('which voice speaks', () => {
  it('uses the reader\'s choice for the language, else the best voice for it, else the device\'s own', () => {
    const all = [voice('Anna', 'de-DE'), voice('Heera', 'bn-IN'), voice('Sam', 'en-US'), voice('Ana', 'en-GB')]
    expect(speech.pickVoice('en-GB', all).name).toBe('Ana') // an exact tag before a same-language one
    speech.setVoicePrefs(JSON.stringify({ en: 'Sam' }))
    expect(speech.pickVoice('en-GB', all).name).toBe('Sam') // the reader's choice wins
    speech.setVoicePrefs(JSON.stringify({ en: 'A voice this device lacks' }))
    expect(speech.pickVoice('en', all).name).not.toBe('A voice this device lacks')
    expect(speech.pickVoice('fr', all)).toBeNull() // none: the device's own default
  })
})

describe('the control', () => {
  it('is not drawn where the device has no voices, and appears when the first one does', async () => {
    render(<SpeakButton id="a" segments={() => []} />)
    expect(screen.queryByTestId('speak-button')).toBeNull()
    await arrive(voice('Sam', 'en-US'))
    expect(screen.getByTestId('speak-button')).toBeTruthy()
  })

  it('speaks nothing on its own', async () => {
    await arrive(voice('Sam', 'en-US'))
    render(<QuoteSpeakButton kind="book" item={{ id: 1, quote: 'Hello.', language: 'English' }} />)
    expect(SPOKEN).toEqual([])
  })

  it('speaks the card\'s text in its own language, shows stop while it plays, and stops on a second press', async () => {
    await arrive(voice('Heera', 'bn-IN'))
    render(<QuoteSpeakButton kind="book" item={{ id: 1, quote: 'আমার সোনার বাংলা', language: 'Bengali', note: 'not read' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Read aloud' }))
    expect(lastText()).toEqual(['bn:আমার সোনার বাংলা'])
    expect(SPOKEN[0].voice.name).toBe('Heera')
    const stopBtn = screen.getByRole('button', { name: 'Stop reading' })
    fireEvent.click(stopBtn)
    expect(screen.getByRole('button', { name: 'Read aloud' })).toBeTruthy()
    expect(CANCELS).toBeGreaterThan(0)
  })

  it('lets one passage play at a time: starting another stops the first', async () => {
    await arrive(voice('Sam', 'en-US'))
    render(
      <>
        <QuoteSpeakButton kind="book" item={{ id: 1, quote: 'First.', language: 'English' }} />
        <QuoteSpeakButton kind="book" item={{ id: 2, quote: 'Second.', language: 'English' }} />
      </>,
    )
    const [one, two] = screen.getAllByTestId('speak-button')
    fireEvent.click(one)
    fireEvent.click(two)
    expect(screen.getAllByRole('button', { name: 'Stop reading' })).toHaveLength(1)
    expect(lastText()).toEqual(['en:First.', 'en:Second.'])
    expect(CANCELS).toBeGreaterThan(0)
  })

  it('keeps the same text in two kinds apart: a book line and a screen line with one id are two passages', async () => {
    await arrive(voice('Sam', 'en-US'))
    render(
      <>
        <QuoteSpeakButton kind="book" item={{ id: 7, quote: 'A.' }} />
        <QuoteSpeakButton kind="screen" item={{ id: 7, quote: 'B.' }} />
      </>,
    )
    fireEvent.click(screen.getAllByTestId('speak-button')[0])
    expect(screen.getAllByRole('button', { name: 'Stop reading' })).toHaveLength(1)
  })
})

describe('a run', () => {
  it('speaks each segment in order, the next only when the last has ended, and stops at the end', async () => {
    await arrive(voice('Sam', 'en-US'))
    speech.speak('run:test', [{ text: 'One', lang: 'en' }, { text: 'Two', lang: 'en' }, { text: 'Three', lang: 'en' }])
    expect(lastText()).toEqual(['en:One'])
    finishCurrent()
    expect(lastText()).toEqual(['en:One', 'en:Two'])
    finishCurrent()
    finishCurrent()
    expect(lastText()).toEqual(['en:One', 'en:Two', 'en:Three'])
    expect(speech.speechSnapshot().id).toBeNull()
  })

  it('skips to the next segment on Next, and stops dead on Stop', async () => {
    await arrive(voice('Sam', 'en-US'))
    speech.speak('run:test', [{ text: 'One', lang: 'en' }, { text: 'Two', lang: 'en' }])
    speech.next()
    expect(lastText()).toEqual(['en:One', 'en:Two'])
    speech.stop()
    expect(speech.speechSnapshot().id).toBeNull()
    // a late end from the cancelled utterance does not resume anything
    SPOKEN[0].onend?.()
    expect(lastText()).toEqual(['en:One', 'en:Two'])
  })

  it('an anthology says its intro, then each entry as the page draws it: note, passage, attribution', () => {
    const slots = [
      { type: 'section', section: { id: 3, title: 'Part one', prose: 'Where it begins.' } },
      { type: 'entry', entry: { kind: 'book', item_id: 1, quote: 'To live deliberately.', language: 'English', note: 'My margin.', credit: 'Thoreau', source: 'Walden' } },
    ]
    const say = (segs) => segs.map((s) => s.text)
    expect(say(anthologyRun({ intro: 'An intro.' }, slots))).toEqual([
      'An intro.', 'Part one', 'Where it begins.', 'My margin.', 'To live deliberately.', 'Thoreau, Walden',
    ])
    // what the anthology's switches hide is not spoken
    expect(say(anthologyRun({ intro: '', hide_commentary: true, hide_credit: true }, slots))).toEqual([
      'Part one', 'Where it begins.', 'To live deliberately.', 'Walden',
    ])
    expect(say(anthologyRun({ hide_credit: true, hide_source: true }, slots))).not.toContain('Walden')
  })

  it('a board says each quote, then who and where, in the order given', () => {
    const say = (segs) => segs.map((s) => s.text)
    expect(say(boardRun([
      { id: 1, quote: 'Q1', credit: 'A', source: 'S' },
      { id: 2, quote: 'Q2', speaker: 'B' },
    ]))).toEqual(['Q1', 'A, S', 'Q2', 'B'])
  })
})
