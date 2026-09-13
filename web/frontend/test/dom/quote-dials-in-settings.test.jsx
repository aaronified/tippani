// THE TWO CONTROLS THEMSELVES, RENDERED.
//
// WHY THIS EXISTS. Everything else about the reading dials is proved without the
// panel: `quote-dials.test.js` does the arithmetic and the defaults,
// `quote-dials-reach-the-page.test.jsx` does the wiring onto <html>, and the Go
// suite does the round trip. None of them opens the thing a reader actually
// touches, so the whole feature could ship with a control that renders a
// placeholder where its label should be and every one of them would stay green.
//
// AND `locale-complete.test.js` DOES NOT COVER IT EITHER, which is the part worth
// writing down. A rater deleted `settings.appearance.quote-leading.loose` from
// en.txt and that suite stayed green: it glob-matches the stem, so a key that is
// missing — or misspelt at the call site — renders a humanised placeholder and
// nothing says so. That is a hole in the catalogue guard rather than in this
// feature (its own task), but it is exactly why the assertions below name the
// RESOLVED WORDS and not the keys: a test that asserted `t('…loose')` was called
// would pass on the placeholder too.
//
// WHAT IT PINS:
//   - both labels and every option resolve to real words, not placeholders
//   - an untouched account shows the leading the app has always drawn, and no
//     measure — the promise that matters most, at the surface a reader sees it
//   - choosing a step sends THAT field and nothing else, and applies before the
//     request returns (§4's rule for every control on this card)
//   - the page answers immediately, so the dial is not waiting on a round trip
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { QuoteReadingFields } from '../../src/Settings.jsx'
import { applyTypeScale } from '../../src/type.js'
import { SRC } from '../src-files.js'

// THE CATALOGUE ITSELF, because "does this look like a key" cannot answer the
// question. The first draft of this file asked exactly that — a regex for dots and
// stems — and a mutation that misspelt one step's key sailed through it: the
// catalogue humanises a missing key, so `…quote-leading.looose` renders as
// "Looose", which has no dot, no stem, and looks like a word. The only honest test
// is against the catalogue's own text: what the control DREW must be what en.txt
// says for the key it was supposed to ask for.
const EN = readFileSync(join(SRC, '..', '..', '..', 'internal', 'i18n', 'en.txt'), 'utf8')
function say(key, vars = {}) {
  const m = EN.match(new RegExp(`^${key.replace(/[.]/g, '\\.')} = (.*)$`, 'm'))
  if (!m) throw new Error(`en.txt has no ${key} — the catalogue moved, or this guard did`)
  return m[1].replace(/\{(\w+)\}/g, (_, k) => String(vars[k]))
}

// `Select` is the app's own control, not a native <select>: a trigger button that
// opens a portalled `role="listbox"` of `role="option"` buttons (ui.jsx). So the
// dials are driven the way a reader drives them — press the trigger, press the
// option — which is also what makes this a test of the control rather than of a
// value being passed around.
const triggers = () => [...document.querySelectorAll('.tp-select-trigger')]
const shown = (t) => t.querySelector('span')?.textContent || ''

async function pick(user, trigger, optionText) {
  await user.click(trigger)
  const opt = [...document.querySelectorAll('[role="option"]')]
    .find((o) => (o.textContent || '').trim() === optionText)
  if (!opt) throw new Error(`no option "${optionText}" — saw ${[...document.querySelectorAll('[role="option"]')].map((o) => o.textContent).join(' | ')}`)
  await user.click(opt)
}

let sent
beforeEach(() => {
  sent = []
  vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null })
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  applyTypeScale({})
})

describe('the two reading dials, as a reader meets them', () => {
  it('draw the words the catalogue holds for them', () => {
    render(<QuoteReadingFields prefs={{}} />)
    for (const key of ['quote-leading', 'quote-measure']) {
      expect(screen.getByText(say(`settings.appearance.${key}.label`)),
        `the ${key} label is not the catalogue’s`).toBeTruthy()
    }
  })

  it('and every step of both lists is the catalogue’s word for its own key', async () => {
    // A single MISSPELT key is the failure that hides — the catalogue humanises
    // what it cannot find, so four steps resolve, one renders "Looose", and the
    // list still reads like a list. Comparing against en.txt is the only way to
    // tell the two apart.
    const user = userEvent.setup()
    render(<QuoteReadingFields prefs={{}} />)
    const open = async (t) => {
      await user.click(t)
      const got = [...document.querySelectorAll('[role="option"]')].map((o) => (o.textContent || '').trim())
      await user.click(t)
      return got
    }
    const [leading, measure] = triggers()
    expect(await open(leading), 'the leading steps are not the catalogue’s five').toEqual(
      ['tight', 'snug', 'normal', 'relaxed', 'loose'].map((n) => say(`settings.appearance.quote-leading.${n}`)),
    )
    expect(await open(measure), 'the measure steps are not the catalogue’s').toEqual([
      say('settings.appearance.quote-measure.full'),
      ...[45, 55, 66, 80].map((n) => say('settings.appearance.quote-measure.chars', { n })),
    ])
  })

  it('show the app’s own setting to a reader who has chosen nothing', () => {
    // THE PROMISE THAT MATTERS MOST, at the surface rather than in the arithmetic:
    // every account alive today stores 0 for both.
    render(<QuoteReadingFields prefs={{}} />)
    const [leading, measure] = triggers()
    expect(shown(leading), 'an untouched account is not showing the app’s own leading')
      .toBe(say('settings.appearance.quote-leading.normal'))
    expect(shown(measure), 'an untouched account is not showing full width')
      .toBe(say('settings.appearance.quote-measure.full'))
  })

  it('send the one field they are for, and apply it before the server answers', async () => {
    const onPreferences = vi.fn()
    const user = userEvent.setup()
    render(<QuoteReadingFields prefs={{ quoteLeading: 0, quoteMeasure: 0 }} onPreferences={onPreferences} />)

    await pick(user, triggers()[1], say('settings.appearance.quote-measure.chars', { n: 66 }))

    await waitFor(() => expect(sent.length).toBe(1))
    // ONE FIELD. The Appearance card's own hazard, which its comments keep
    // warning about: a preference riding in a full-state object is wiped by an
    // unrelated click. This control writes what it is for and nothing else.
    expect(sent[0].body).toEqual({ quoteMeasure: 66 })
    expect(sent[0].url).toContain('/auth/me/preferences')
    // And the page already answers, without waiting for the round trip.
    expect(document.documentElement.style.getPropertyValue('--quote-measure')).toBe('66ch')
    await waitFor(() => expect(onPreferences).toHaveBeenCalledWith({ quoteMeasure: 66 }))
  })

  it('put the old setting back when the server refuses', async () => {
    // The other half of applying early: a reader must never be left looking at a
    // setting their account does not have.
    applyTypeScale({ quoteLeading: 190 })
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response('{"error":"nope"}', { status: 400, headers: { 'content-type': 'application/json' } }),
    )
    const onPreferences = vi.fn()
    const user = userEvent.setup()
    render(<QuoteReadingFields prefs={{ quoteLeading: 190 }} onPreferences={onPreferences} />)

    await pick(user, triggers()[0], say('settings.appearance.quote-leading.tight'))

    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--quote-leading'),
        'a refused save left the reader looking at a setting they do not have').toBe('1.9'))
    expect(onPreferences, 'a refused save was reported upward as though it took').not.toHaveBeenCalled()
  })
})
